using System.Globalization;
using System.Text;
using ClosedXML.Excel;
using CsvHelper;
using CsvHelper.Configuration;
using FuzzySharp;
using SetupDashboard.Models;

namespace SetupDashboard.Services;

/// <summary>
/// Smart CSV/Excel uploader with fuzzy column matching.
/// Ported from BulkImport's FieldMappingUtility pattern + AI-assisted fuzzy matching.
/// </summary>
public class SmartUploaderService
{
    private readonly ILogger<SmartUploaderService> _logger;

    // Known system signatures for auto-detection
    private static readonly Dictionary<string, string[]> KnownSystems = new()
    {
        ["Key Software"] = ["CustomerID", "CustName", "CustCode", "DelAddr1"],
        ["Elite EXTRA"] = ["OrderID", "OrderDate", "PickupAddress", "DeliveryAddress"],
        ["Datatrac"] = ["ACCOUNT", "SHIPPER", "CONSIGNEE", "PCS"],
        ["OnTime"] = ["OrderNumber", "Shipper", "Receiver", "Pieces"],
        ["GetSwift"] = ["booking_id", "pickup_name", "dropoff_name"],
        ["Track-POD"] = ["Order #", "Sender", "Receiver", "Status"],
        ["DFRNT"] = ["ClientCode", "FromCompany", "ToCompany", "ServiceType"],
    };

    // Store parsed data per session for preview/import flow
    private readonly Dictionary<string, (List<string[]> Rows, List<string> Headers, string EntityType)> _uploadCache = new();

    public SmartUploaderService(ILogger<SmartUploaderService> logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// Parse file (CSV or Excel), detect system, auto-map columns.
    /// </summary>
    public async Task<DetectionResult> DetectAndMapAsync(Stream fileStream, string fileName, string entityType, string sessionId)
    {
        var (headers, rows) = await ParseFileAsync(fileStream, fileName);

        if (headers.Count == 0)
            return new DetectionResult { Success = false, Message = "No headers found in file" };

        // Cache for preview/import
        _uploadCache[sessionId] = (rows, headers, entityType);

        // Detect source system
        var (system, systemConfidence) = DetectSystem(headers);

        // Get target field definitions
        if (!EntityDefinitions.Fields.TryGetValue(entityType, out var targetFields))
            return new DetectionResult { Success = false, Message = $"Unknown entity type: {entityType}" };

        // Map columns using fuzzy matching
        var mappings = MapColumns(headers, targetFields);

        var avgConfidence = mappings.Count > 0
            ? (int)mappings.Where(m => !string.IsNullOrEmpty(m.DfField)).Average(m => m.Confidence)
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
            DfFields = targetFields.Select(f => f.FieldName).ToList(),
        };
    }

    /// <summary>
    /// Generate preview of mapped data.
    /// </summary>
    public PreviewResult GeneratePreview(string sessionId, List<FieldMapping> mappings, string entityType, int maxRows = 20)
    {
        if (!_uploadCache.TryGetValue(sessionId, out var cached))
            return new PreviewResult { Success = false, Message = "No upload found. Upload a file first." };

        var (rows, headers, _) = cached;
        var result = new PreviewResult();
        var validation = new ValidationResult();

        // Build header index
        var headerIndex = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        for (int i = 0; i < headers.Count; i++)
            headerIndex[headers[i]] = i;

        // Get required fields
        var requiredFields = EntityDefinitions.Fields.TryGetValue(entityType, out var defs)
            ? defs.Where(d => d.Required).Select(d => d.FieldName).ToHashSet()
            : new HashSet<string>();

        // Check that all required fields are mapped
        var mappedFields = mappings.Where(m => !string.IsNullOrEmpty(m.DfField)).Select(m => m.DfField).ToHashSet();
        foreach (var req in requiredFields)
        {
            if (!mappedFields.Contains(req))
                validation.Errors.Add($"Required field '{req}' is not mapped to any CSV column");
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
        int rowNum = 0;
        foreach (var row in rows)
        {
            rowNum++;
            foreach (var mapping in mappings.Where(m => requiredFields.Contains(m.DfField)))
            {
                if (headerIndex.TryGetValue(mapping.CsvColumn, out var idx) && idx < row.Length)
                {
                    if (string.IsNullOrWhiteSpace(row[idx]))
                        validation.Warnings.Add($"Row {rowNum}: Required field '{mapping.DfField}' is empty");
                }
            }

            // Check for duplicate detection
            if (rowNum > 1)
            {
                var nameMapping = mappings.FirstOrDefault(m => m.DfField is "Name" or "ClientName" or "ZoneName");
                if (nameMapping != null && headerIndex.TryGetValue(nameMapping.CsvColumn, out var nameIdx))
                {
                    var name = nameIdx < row.Length ? row[nameIdx] : "";
                    var prevNames = rows.Take(rowNum - 1)
                        .Select(r => nameIdx < r.Length ? r[nameIdx] : "")
                        .ToList();
                    if (prevNames.Contains(name, StringComparer.OrdinalIgnoreCase))
                        validation.Warnings.Add($"Row {rowNum}: Possible duplicate '{name}'");
                }
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
            throw new InvalidOperationException("No upload found. Upload a file first.");

        var (rows, headers, _) = cached;
        var headerIndex = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        for (int i = 0; i < headers.Count; i++)
            headerIndex[headers[i]] = i;

        var result = new List<Dictionary<string, string?>>();
        foreach (var row in rows)
        {
            var mapped = new Dictionary<string, string?>();
            foreach (var mapping in mappings.Where(m => !string.IsNullOrEmpty(m.DfField)))
            {
                if (headerIndex.TryGetValue(mapping.CsvColumn, out var idx) && idx < row.Length)
                    mapped[mapping.DfField] = ApplyTransform(row[idx], mapping.Transform)?.ToString();
                else
                    mapped[mapping.DfField] = null;
            }
            result.Add(mapped);
        }

        return result;
    }

    /// <summary>
    /// Generate a CSV template for a given entity type.
    /// </summary>
    public byte[] GenerateTemplate(string entityType)
    {
        var headers = EntityDefinitions.GetTemplateHeaders(entityType);
        if (headers.Count == 0)
            throw new ArgumentException($"Unknown entity type: {entityType}");

        using var ms = new MemoryStream();
        using var writer = new StreamWriter(ms, Encoding.UTF8);
        writer.WriteLine(string.Join(",", headers.Select(h => $"\"{h}\"")));
        // Write an example row
        var fields = EntityDefinitions.Fields[entityType];
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
            "ZipCode" or "ZipCode" => "75001",
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
    public void ClearCache(string sessionId) => _uploadCache.Remove(sessionId);

    // --- Private helpers ---

    private async Task<(List<string> Headers, List<string[]> Rows)> ParseFileAsync(Stream stream, string fileName)
    {
        var ext = Path.GetExtension(fileName).ToLowerInvariant();
        return ext switch
        {
            ".xlsx" or ".xls" => ParseExcel(stream),
            _ => await ParseCsvAsync(stream),
        };
    }

    private async Task<(List<string> Headers, List<string[]> Rows)> ParseCsvAsync(Stream stream)
    {
        using var reader = new StreamReader(stream);
        using var csv = new CsvReader(reader, new CsvConfiguration(CultureInfo.InvariantCulture)
        {
            HasHeaderRecord = true,
            MissingFieldFound = null,
            BadDataFound = null,
            TrimOptions = TrimOptions.Trim,
        });

        await csv.ReadAsync();
        csv.ReadHeader();
        var headers = csv.HeaderRecord?.ToList() ?? new();

        var rows = new List<string[]>();
        while (await csv.ReadAsync())
        {
            var row = new string[headers.Count];
            for (int i = 0; i < headers.Count; i++)
                row[i] = csv.GetField(i) ?? "";
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
            return (new(), new());

        var headers = new List<string>();
        var firstRow = range.FirstRow();
        foreach (var cell in firstRow.Cells())
            headers.Add(cell.GetString().Trim());

        var rows = new List<string[]>();
        foreach (var row in range.RowsUsed().Skip(1))
        {
            var values = new string[headers.Count];
            for (int i = 0; i < headers.Count; i++)
                values[i] = row.Cell(i + 1).GetString().Trim();
            rows.Add(values);
        }

        return (headers, rows);
    }

    private (string System, int Confidence) DetectSystem(List<string> headers)
    {
        var headerSet = new HashSet<string>(headers, StringComparer.OrdinalIgnoreCase);

        foreach (var (system, signatures) in KnownSystems)
        {
            var matches = signatures.Count(s => headerSet.Contains(s));
            if (matches >= 2)
                return (system, Math.Min(100, matches * 100 / signatures.Length));
        }

        return ("Unknown / Custom CSV", 50);
    }

    /// <summary>
    /// Map CSV columns to target fields using fuzzy string matching.
    /// Ported from BulkImport FieldMappingUtility + enhanced with FuzzySharp.
    /// </summary>
    private List<FieldMapping> MapColumns(List<string> csvHeaders, List<EntityFieldDefinition> targetFields)
    {
        var mappings = new List<FieldMapping>();
        var usedTargets = new HashSet<string>();

        foreach (var header in csvHeaders)
        {
            var bestMatch = "";
            var bestScore = 0;

            foreach (var target in targetFields)
            {
                if (usedTargets.Contains(target.FieldName))
                    continue;

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

                foreach (var candidate in candidates)
                {
                    var score = Fuzz.Ratio(normalizedHeader, candidate);
                    // Also try partial ratio for substrings
                    var partialScore = Fuzz.PartialRatio(normalizedHeader, candidate);
                    var finalScore = Math.Max(score, partialScore);

                    if (finalScore > bestScore && finalScore >= 60)
                    {
                        bestMatch = target.FieldName;
                        bestScore = finalScore;
                    }
                }
            }

            mappings.Add(new FieldMapping
            {
                CsvColumn = header,
                DfField = bestScore >= 60 ? bestMatch : "",
                Confidence = bestScore >= 60 ? bestScore : 0,
            });

            if (!string.IsNullOrEmpty(bestMatch) && bestScore >= 60)
                usedTargets.Add(bestMatch);
        }

        return mappings;
    }

    private static string NormalizeFieldName(string name)
        => name.Replace("_", "").Replace("-", "").Replace(" ", "").ToLowerInvariant();

    private static object? ApplyTransform(string? value, string? transform)
    {
        if (string.IsNullOrEmpty(value)) return value;
        return transform?.ToLower() switch
        {
            "uppercase" => value.ToUpperInvariant(),
            "lowercase" => value.ToLowerInvariant(),
            "trim" => value.Trim(),
            "boolean" => value.Trim().ToLower() is "true" or "yes" or "1" or "y",
            "number" => decimal.TryParse(value, out var n) ? n : value,
            _ => value,
        };
    }
}
