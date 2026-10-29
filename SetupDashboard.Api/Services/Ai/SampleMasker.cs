using System.Text.RegularExpressions;

namespace SetupDashboard.Services.Ai;

/// <summary>
/// What a sample value from a tenant's file looks like before it leaves for the Claude API: emails become
/// <c>name@example.com</c> and every digit becomes 9, so phones, post codes and prices keep their shape
/// (which is what tells one column from another) but not their content.
/// </summary>
public static partial class SampleMasker
{
    public const int MaxLength = 60;

    public static string Mask(string value)
    {
        var masked = Digit().Replace(Email().Replace(value, "name@example.com"), "9");
        return masked.Length <= MaxLength ? masked : masked[..MaxLength];
    }

    [GeneratedRegex(@"[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+")]
    private static partial Regex Email();

    [GeneratedRegex(@"\d")]
    private static partial Regex Digit();
}
