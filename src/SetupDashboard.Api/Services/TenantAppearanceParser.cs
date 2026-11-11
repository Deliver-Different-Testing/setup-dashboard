using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;

namespace SetupDashboard.Services;

/// <summary>
/// The tenant's Branding, from <c>tblSetting.AppearanceDefaultsJson</c> (edited on the configurator's
/// Branding page). Only set fields are present; the client themes from it (styles/appearance.ts).
/// </summary>
public sealed record TenantAppearance(
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Contrast,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Primary,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Secondary,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? TextLight,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? TextDark);

/// <summary>
/// Validates the stored blob the same way the configurator and Hub do: <c>contrast</c> is auto, standard
/// or high; each colour is <c>#rrggbb</c>. Invalid fields are dropped; malformed JSON or nothing valid
/// means the tenant has no Branding (null).
/// </summary>
public static partial class TenantAppearanceParser
{
    private static readonly string[] ContrastValues = ["auto", "standard", "high"];

    [GeneratedRegex("^#[0-9a-fA-F]{6}$")]
    private static partial Regex HexColour();

    public static TenantAppearance? Parse(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return null;
        }

        try
        {
            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.ValueKind != JsonValueKind.Object)
            {
                return null;
            }

            var root = doc.RootElement;
            var contrast = Read(root, "contrast") is { } c && ContrastValues.Contains(c) ? c : null;
            var appearance = new TenantAppearance(
                contrast, Colour(root, "primary"), Colour(root, "secondary"), Colour(root, "textLight"), Colour(root, "textDark"));

            return appearance == new TenantAppearance(null, null, null, null, null) ? null : appearance;
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static string? Colour(JsonElement root, string name) =>
        Read(root, name) is { } value && HexColour().IsMatch(value) ? value.ToLowerInvariant() : null;

    private static string? Read(JsonElement root, string name) =>
        root.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() : null;
}
