using SetupDashboard.Models;
using SetupDashboard.Services.Ai;

namespace SetupDashboard.Interfaces;

/// <summary>
/// Second opinion for Smart Import: which target field each unmatched column most likely holds.
/// Suggestions only - the person confirms every mapping in the preview before anything is loaded.
/// </summary>
public interface IColumnMappingAdvisor
{
    /// <summary>Column name to field name, for the columns it is confident about. Never throws for an API failure.</summary>
    Task<IReadOnlyDictionary<string, string>> SuggestAsync(string entityType, IReadOnlyList<ColumnSample> columns,
        IReadOnlyList<EntityFieldDefinition> fields, CancellationToken ct = default);
}