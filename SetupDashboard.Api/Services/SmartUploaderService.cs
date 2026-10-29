using System.Globalization;
using System.Text;
using ClosedXML.Excel;
using CsvHelper;
using ExcelDataReader;
using FuzzySharp;
using Serilog;
using SetupDashboard.Models;
using SetupDashboard.Services.Ai;

namespace SetupDashboard.Services;

/// <summary>
/// Smart CSV/Excel uploader with fuzzy column matching.
/// Ported from BulkImport's FieldMappingUtility pattern; columns the name match can't place are
/// offered to the <see cref="IColumnMappingAdvisor"/> (Claude) as suggestions.
/// </summary>
public class SmartUploaderService(IColumnMappingAdvisor? advisor = null)
{
    /// <summary>Below the name match's 75, so an AI suggestion never looks as sure as a name match.</summary>
    internal const int AiConfidence = 70;

    private const int SamplesPerColumn = 3;

    /// <summary>The upload is waiting on this; past it the name match stands alone.</summary>
    private static readonly TimeSpan AdvisorTimeout = TimeSpan.FromSeconds(30);

    private readonly IColumnMappingAdvisor _advisor = advisor ?? new NoColumnMappingAdvisor();

    // Known system signatures for auto-detection
    private static readonly Dictionary<string, string[]> KnownSystems = new()
    {
        ["Key Software"] = ["CustomerID", "CustName", "CustCode", "DelAddr1"],
        ["Elite EXTRA"] = ["OrderID", "OrderDate", "PickupAddress", "DeliveryAddress"],
        ["Datatrac"] = ["ACCOUNT", "SHIPPER", "CONSIGNEE", "PCS"],
        ["OnTime"] = ["OrderNumber", "Shipper", "Receiver", "Pieces"],
        ["GetSwift"] = ["booking_id", "pickup_name", "dropoff_name"],
        ["Track-POD"] = ["Order #", "Sender", "Receiver", "Status"],
        ["DFRNT"] = ["ClientCode", "FromCompany", "ToCompany", "ServiceType"]
    };

    // Store parsed data per session for preview/import flow
    private readonly System.Collections.Concurrent.ConcurrentDictionary<string, (List<string[]> Rows, List<string> Headers, string EntityType)> _uploadCache = new();

    /// <summary>
    /// Parse file (CSV or Excel), detect system, auto-map columns.
    /// </summary>
    public async Task<DetectionResult> DetectAndMapAsync(Stream fileStream, string fileName, string entityType, string sessionId,
        CancellationToken ct = default)
    {
        var (headers, rows) = await ParseFileAsync(fileStream, fileName);

        if (headers.Count == 0)
        {
            return new DetectionResult { Success = false, Message = "No headers found in file" };
        }

        // Cache for preview/import
        _uploadCache[sessionId] = (rows, headers, entityType);

        // Detect source system
        var (system, systemConfidence) = DetectSystem(headers);

        // Get target field definitions
        if (EntityDefinitions.For(entityType) is not { } targetFields)
        {
            return new DetectionResult { Success = false, Message = $"Unknown entity type: {entityType}" };
        }

        // Map columns using fuzzy matching
        var mappings = MapColumns(headers, targetFields);
        await AddAdvisorSuggestionsAsync(mappings, headers, rows, entityType, targetFields, ct);

        var matchedMappings = mappings.Where(m => !string.IsNullOrEmpty(m.DfField)).ToList();
        var avgConfidence = matchedMappings.Count > 0
            ? (int)matchedMappings.Average(m => m.Confidence)
            : 0;

        return new DetectionResult
        {
            Success = true,
            System = system,
            Confidence = Math.Max(systemConfidence, avgConfidence),
            EntityType = entityType,
            Headers = headers,
            RowCount = rows.Count,
            SuggestedMappings = mappings,
            DfFields = targetFields.Select(f => f.FieldName).ToList()
        };
    }

    /// <summary>
    /// Generate preview of mapped data.
    /// </summary>
    public PreviewResult GeneratePreview(string sessionId, List<FieldMapping> mappings, string entityType, int maxRows = 20)
    {
        if (!_uploadCache.TryGetValue(sessionId, out var cached))
        {
            return new PreviewResult { Success = false, Message = "No upload found. Upload a file first." };
        }

        var (rows, headers, _) = cached;
        var result = new PreviewResult();
        var validation = new ValidationResult();

        // Build header index
        var headerIndex = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        for (var i = 0; i < headers.Count; i++)
            headerIndex[headers[i]] = i;

        // Get required fields
        var requiredFields = EntityDefinitions.For(entityType) is { } defs
            ? defs.Where(d => d.Required).Select(d => d.FieldName).ToHashSet()
            : new HashSet<string>();

        // Check that all required fields are mapped
        var mappedFields = mappings.Where(m => !string.IsNullOrEmpty(m.DfField)).Select(m => m.DfField).ToHashSet();
        foreach (var req in requiredFields.Where(req => !mappedFields.Contains(req)))
        {
            validation.Warnings.Add($"'{req}' isn't in this file. Rows will come in, but each will need it filled in before it can be sent.");
        }

        // Map rows
        var previewRows = rows.Take(maxRows).ToList();
        foreach (var row in previewRows)
        {
            var mapped = new Dictionary<string, object?>();
            foreach (var mapping in mappings.Where(m => !string.IsNullOrEmpty(m.DfField)))
            {
                if (headerIndex.TryGetValue(mapping.CsvColumn, out var idx) && idx < row.Length)
                {
                    var value = row[idx];
                    mapped[mapping.DfField] = ApplyTransform(value, mapping.Transform);
                }
                else
                {
                    mapped[mapping.DfField] = null;
                }
            }
            result.Preview.Add(mapped);
        }

        // Validate data
        var rowNum = 0;
        foreach (var row in rows)
        {
            rowNum++;
            foreach (var mapping in mappings.Where(m => requiredFields.Contains(m.DfField)))
            {
                if (!headerIndex.TryGetValue(mapping.CsvColumn, out var idx) || idx >= row.Length)
                {
                    continue;
                }

                if (string.IsNullOrWhiteSpace(row[idx]))
                {
                    validation.Warnings.Add($"Row {rowNum}: Required field '{mapping.DfField}' is empty");
                }
            }

            // Check for duplicate detection
            if (rowNum <= 1)
            {
                continue;
            }

            var nameMapping = mappings.FirstOrDefault(m => m.DfField is "Name" or "ClientName" or "ZoneName");
            if (nameMapping == null || !headerIndex.TryGetValue(nameMapping.CsvColumn, out var nameIdx))
            {
                continue;
            }

            var name = nameIdx < row.Length ? row[nameIdx] : string.Empty;
            var prevNames = rows.Take(rowNum - 1)
                .Select(r => nameIdx < r.Length ? r[nameIdx] : "")
                .ToList();
            if (prevNames.Contains(name, StringComparer.OrdinalIgnoreCase))
            {
                validation.Warnings.Add($"Row {rowNum}: Possible duplicate '{name}'");
            }
        }

        result.Validation = validation;
        result.Success = validation.Errors.Count == 0;
        return result;
    }

    /// <summary>
    /// Execute import: maps all rows using confirmed mappings.
    /// Returns mapped data that controllers can then push to Admin Manager API.
    /// </summary>
    public List<Dictionary<string, string?>> ExecuteMapping(string sessionId, List<FieldMapping> mappings)
    {
        if (!_uploadCache.TryGetValue(sessionId, out var cached))
        {
            throw new InvalidOperationException("No upload found. Upload a file first.");
        }

        var (rows, headers, _) = cached;
        var headerIndex = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        for (var i = 0; i < headers.Count; i++)
            headerIndex[headers[i]] = i;

        var result = new List<Dictionary<string, string?>>();
        foreach (var row in rows)
        {
            var mapped = new Dictionary<string, string?>();
            foreach (var mapping in mappings.Where(m => !string.IsNullOrEmpty(m.DfField)))
            {
                if (headerIndex.TryGetValue(mapping.CsvColumn, out var idx) && idx < row.Length)
                {
                    mapped[mapping.DfField] = ApplyTransform(row[idx], mapping.Transform)?.ToString();
                }
                else
                {
                    mapped[mapping.DfField] = null;
                }
            }
            result.Add(mapped);
        }

        return result;
    }

    /// <summary>
    /// Generate a CSV template for a given entity type.
    /// </summary>
    public static byte[] GenerateTemplate(string entityType)
    {
        var headers = EntityDefinitions.GetTemplateHeaders(entityType);
        if (headers.Count == 0)
        {
            throw new ArgumentException($"Unknown entity type: {entityType}");
        }

        using var ms = new MemoryStream();
        using var writer = new StreamWriter(ms, Encoding.UTF8);
        writer.WriteLine(string.Join(",", headers.Select(h => $"\"{h}\"")));
        // Write an example row
        var fields = EntityDefinitions.For(entityType) ?? throw new ArgumentException($"Unknown entity type: {entityType}");
        var exampleValues = fields.Select(f => f.FieldName switch
        {
            "Name" or "ClientName" or "ZoneName" => "Example Corp",
            "Code" => "EX001",
            "Contact" or "FirstName" => "John",
            "LastName" or "SurName" => "Doe",
            "Phone" => "(555) 123-4567",
            "Email" => "john@example.com",
            "Billing" => "Monthly",
            "City" or "Location" => "Dallas",
            "State" => "TX",
            "ZipCode" => "75001",
            "Vehicle" => "Van",
            "Zone" => "Downtown",
            "Rate" => "12.50",
            "MinWeight" => "0",
            "MaxWeight" => "5",
            _ => ""
        });
        writer.WriteLine(string.Join(",", exampleValues.Select(v => $"\"{v}\"")));
        writer.Flush();
        return ms.ToArray();
    }

    /// <summary>
    /// Remove cached upload data for a session.
    /// </summary>
    public void ClearCache(string sessionId) => _uploadCache.TryRemove(sessionId, out _);

    // --- Private helpers ---

    internal async Task<(List<string> Headers, List<string[]> Rows)> ParseFileAsync(Stream stream, string fileName)
    {
        var ext = Path.GetExtension(fileName).ToLowerInvariant();
        return ext switch
        {
            ".xlsx" => ParseExcel(stream),
            ".xls" => ParseLegacyExcel(stream),
            ".csv" or ".tsv" or ".txt" => await ParseCsvAsync(stream),
            _ => throw new ArgumentException($"Unsupported file format: {ext}. Supported formats: .csv, .xlsx, .xls")
        };
    }

    private async Task<(List<string> Headers, List<string[]> Rows)> ParseCsvAsync(Stream stream)
    {
        await using var csv = CsvReader.Create(stream, new CsvReaderOptions
        {
            Separator = ',',
            HasHeader = true,
            TrimWhitespace = true,
            MissingField = CsvMissingFieldHandling.ReturnEmpty,
            FieldCountMismatch = CsvFieldCountHandling.Allow,
            MalformedData = CsvMalformedDataHandling.Recover
        });

        await csv.ReadHeaderAsync();
        var headers = csv.Headers.ToList();

        var rows = new List<string[]>();
        while (await csv.ReadAsync())
        {
            var row = new string[headers.Count];
            for (var i = 0; i < headers.Count; i++)
                row[i] = csv.GetString(i);
            rows.Add(row);
        }

        return (headers, rows);
    }

    private (List<string> Headers, List<string[]> Rows) ParseExcel(Stream stream)
    {
        using var workbook = new XLWorkbook(stream);
        var worksheet = workbook.Worksheets.First();
        var range = worksheet.RangeUsed();
        if (range == null)
        {
            return (new(), new());
        }

        // Smart header detection: scan up to first 10 rows to find the best header row.
        // The header row is the one with the most non-empty cells (and ideally text-like values).
        // This handles Excel files with title rows, company info, or decorative content above the real headers.
        var allRows = range.RowsUsed().ToList();
        var headerRowIndex = 0;
        var maxNonEmpty = 0;
        var totalColumns = range.ColumnCount();

        for (var i = 0; i < Math.Min(allRows.Count, 10); i++)
        {
            var row = allRows[i];
            var nonEmptyCells = 0;
            for (var c = 1; c <= totalColumns; c++)
            {
                var val = row.Cell(c).GetString().Trim();
                if (!string.IsNullOrEmpty(val))
                {
                    nonEmptyCells++;
                }
            }

            // Prefer row with most non-empty cells; require at least 2 non-empty columns to be a header
            if (nonEmptyCells <= maxNonEmpty || nonEmptyCells < 2)
            {
                continue;
            }

            maxNonEmpty = nonEmptyCells;
            headerRowIndex = i;
        }

        Log.Information("Excel smart header detection: using row {RowIndex} as header (with {NonEmpty}/{Total} non-empty cells)",
            headerRowIndex + 1, maxNonEmpty, totalColumns);

        var headers = new List<string>();
        var headerRow = allRows[headerRowIndex];
        for (var c = 1; c <= totalColumns; c++)
            headers.Add(headerRow.Cell(c).GetString().Trim());

        var rows = new List<string[]>();
        foreach (var row in allRows.Skip(headerRowIndex + 1))
        {
            var values = new string[headers.Count];
            for (var i = 0; i < headers.Count; i++)
                values[i] = row.Cell(i + 1).GetString().Trim();
            // Skip completely empty rows
            if (values.Any(v => !string.IsNullOrWhiteSpace(v)))
            {
                rows.Add(values);
            }
        }

        return (headers, rows);
    }

    /// <summary>
    /// Parse legacy .xls (BIFF) format using ExcelDataReader.
    /// ClosedXML only supports .xlsx, so we need a separate parser for .xls files.
    /// </summary>
    private (List<string> Headers, List<string[]> Rows) ParseLegacyExcel(Stream stream)
    {
        // ExcelDataReader requires encoding provider registration for .xls
        Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);

        using var reader = ExcelReaderFactory.CreateReader(stream);
        var headers = new List<string>();
        var rows = new List<string[]>();

        // Read all rows first, then detect the best header row
        var allRows = new List<string[]>();
        var fieldCount = 0;

        while (reader.Read())
        {
            if (fieldCount == 0)
            {
                fieldCount = reader.FieldCount;
            }

            var values = new string[fieldCount];
            for (var i = 0; i < fieldCount; i++)
                values[i] = reader.GetValue(i).ToString()?.Trim() ?? string.Empty;
            allRows.Add(values);
        }

        if (allRows.Count == 0)
        {
            return (headers, rows);
        }

        // Smart header detection: find the row (within first 10) with the most non-empty cells
        var headerRowIndex = 0;
        var maxNonEmpty = 0;

        for (var i = 0; i < Math.Min(allRows.Count, 10); i++)
        {
            var nonEmptyCells = allRows[i].Count(v => !string.IsNullOrWhiteSpace(v));
            if (nonEmptyCells <= maxNonEmpty || nonEmptyCells < 2)
            {
                continue;
            }

            maxNonEmpty = nonEmptyCells;
            headerRowIndex = i;
        }

        Log.Information("Legacy Excel smart header detection: using row {RowIndex} as header (with {NonEmpty}/{Total} non-empty cells)",
            headerRowIndex + 1, maxNonEmpty, fieldCount);

        // Use detected header row
        for (var i = 0; i < fieldCount; i++)
        {
            var val = allRows[headerRowIndex][i];
            headers.Add(!string.IsNullOrWhiteSpace(val) ? val : $"Column{i + 1}");
        }

        // Data rows are everything after the header row
        for (var i = headerRowIndex + 1; i < allRows.Count; i++)
        {
            // Skip completely empty rows
            if (allRows[i].Any(v => !string.IsNullOrWhiteSpace(v)))
            {
                rows.Add(allRows[i]);
            }
        }

        return (headers, rows);
    }

    private static (string System, int Confidence) DetectSystem(List<string> headers)
    {
        var headerSet = new HashSet<string>(headers, StringComparer.OrdinalIgnoreCase);

        foreach (var (system, signatures) in KnownSystems)
        {
            var matches = signatures.Count(headerSet.Contains);
            if (matches >= 2)
            {
                return (system, Math.Min(100, matches * 100 / signatures.Length));
            }
        }

        return ("Unknown / Custom CSV", 50);
    }

    /// <summary>
    /// Map CSV columns to target fields using fuzzy string matching.
    /// Ported from BulkImport FieldMappingUtility + enhanced with FuzzySharp.
    /// </summary>
    private static List<FieldMapping> MapColumns(List<string> csvHeaders, List<EntityFieldDefinition> targetFields)
    {
        var mappings = new List<FieldMapping>();
        var usedTargets = new HashSet<string>();

        foreach (var header in csvHeaders)
        {
            var bestMatch = string.Empty;
            var bestScore = 0;

            foreach (var target in targetFields.Where(target => !usedTargets.Contains(target.FieldName)))
            {
                // Exact match on field name
                if (header.Equals(target.FieldName, StringComparison.OrdinalIgnoreCase) ||
                    header.Equals(target.DisplayName, StringComparison.OrdinalIgnoreCase))
                {
                    bestMatch = target.FieldName;
                    bestScore = 100;
                    break;
                }

                // Exact match on aliases
                if (target.Aliases.Any(a => a.Equals(header, StringComparison.OrdinalIgnoreCase)))
                {
                    bestMatch = target.FieldName;
                    bestScore = 95;
                    break;
                }

                // Fuzzy match
                var normalizedHeader = NormalizeFieldName(header);
                var candidates = new[] { target.FieldName, target.DisplayName }
                    .Concat(target.Aliases)
                    .Select(NormalizeFieldName)
                    .ToList();

                foreach (var finalScore in from candidate in candidates let score = Fuzz.Ratio(normalizedHeader, candidate) let partialScore = Fuzz.PartialRatio(normalizedHeader, candidate) select Math.Max(score, (int)(partialScore * 0.85)) into finalScore where finalScore > bestScore && finalScore >= 75 select finalScore)
                {
                    bestMatch = target.FieldName;
                    bestScore = finalScore;
                }
            }

            mappings.Add(new FieldMapping
            {
                CsvColumn = header,
                DfField = bestScore >= 75 ? bestMatch : string.Empty,
                Confidence = bestScore >= 75 ? bestScore : 0
            });

            if (!string.IsNullOrEmpty(bestMatch) && bestScore >= 75)
            {
                usedTargets.Add(bestMatch);
            }
        }

        return mappings;
    }

    /// <summary>
    /// Asks the advisor about the columns left unmapped, sending only their names and a few masked
    /// values. A suggestion is taken only for a field on this step that no column has yet.
    /// </summary>
    private async Task AddAdvisorSuggestionsAsync(List<FieldMapping> mappings, List<string> headers, List<string[]> rows,
        string entityType, List<EntityFieldDefinition> targetFields, CancellationToken ct)
    {
        var unmapped = mappings.Where(m => string.IsNullOrEmpty(m.DfField)).ToList();
        if (unmapped.Count == 0)
        {
            return;
        }

        var samples = unmapped.Select(m =>
        {
            var index = headers.IndexOf(m.CsvColumn);
            var values = rows.Select(r => index < r.Length ? r[index] : string.Empty)
                .Where(v => !string.IsNullOrWhiteSpace(v))
                .Take(SamplesPerColumn)
                .Select(SampleMasker.Mask)
                .ToList();
            return new ColumnSample(m.CsvColumn, values);
        }).ToList();

        IReadOnlyDictionary<string, string> suggestions;
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
        timeout.CancelAfter(AdvisorTimeout);
        try
        {
            suggestions = await _advisor.SuggestAsync(entityType, samples, targetFields, timeout.Token);
        }
        catch (Exception ex) when (!ct.IsCancellationRequested)
        {
            Log.Warning(ex, "Column mapping suggestions failed for {EntityType}; using the name match only", entityType);
            return;
        }

        var valid = targetFields.Select(f => f.FieldName).ToHashSet();
        var taken = mappings.Where(m => !string.IsNullOrEmpty(m.DfField)).Select(m => m.DfField).ToHashSet();
        foreach (var mapping in unmapped)
        {
            if (suggestions.TryGetValue(mapping.CsvColumn, out var field) && valid.Contains(field) && taken.Add(field))
            {
                mapping.DfField = field;
                mapping.Confidence = AiConfidence;
                mapping.Source = SuggestionSource.Ai;
            }
        }
    }

    private static string NormalizeFieldName(string name)
        => name.Replace("_", "").Replace("-", "").Replace(" ", "").ToLowerInvariant();

    private static object? ApplyTransform(string? value, string? transform)
    {
        if (string.IsNullOrEmpty(value))
        {
            return value;
        }

        return transform?.ToLower() switch
        {
            "uppercase" => value.ToUpperInvariant(),
            "lowercase" => value.ToLowerInvariant(),
            "trim" => value.Trim(),
            "boolean" => value.Trim().ToLower() is "true" or "yes" or "1" or "y",
            "number" => decimal.TryParse(value, out var n) ? n : value,
            _ => value
        };
    }
}
