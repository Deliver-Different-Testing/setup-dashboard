using SetupDashboard.Services;

namespace SetupDashboard.Tests;

public class TenantAppearanceParserTests
{
    [Fact]
    public void Reads_every_field_and_lower_cases_colours()
    {
        var a = TenantAppearanceParser.Parse(
            """{"contrast":"high","primary":"#1B5E20","secondary":"#6a1b9a","textLight":"#111111","textDark":"#EEEEEE"}""");

        Assert.Equal(new TenantAppearance("high", "#1b5e20", "#6a1b9a", "#111111", "#eeeeee"), a);
    }

    [Fact]
    public void Keeps_only_the_fields_that_are_set()
    {
        var a = TenantAppearanceParser.Parse("""{"primary":"#3bc7f4"}""");

        Assert.Equal(new TenantAppearance(null, "#3bc7f4", null, null, null), a);
    }

    [Fact]
    public void Drops_invalid_fields()
    {
        var a = TenantAppearanceParser.Parse("""{"contrast":"loud","primary":"red","secondary":"#12345","textLight":"#abcdef"}""");

        Assert.Equal(new TenantAppearance(null, null, null, "#abcdef", null), a);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("{not json")]
    [InlineData("[]")]
    [InlineData("{}")]
    [InlineData("""{"contrast":"loud","primary":"red"}""")]
    public void Nothing_usable_means_no_branding(string? json)
    {
        Assert.Null(TenantAppearanceParser.Parse(json));
    }
}
