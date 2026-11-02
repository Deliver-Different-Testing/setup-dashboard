using System.Text;
using SetupDashboard.Models;
using SetupDashboard.Services;
using SetupDashboard.Services.Ai;

namespace SetupDashboard.Tests;

/// <summary>Records what Smart Import asked for and answers from a script. No network.</summary>
public sealed class FakeAdvisor(Func<IReadOnlyList<ColumnSample>, IReadOnlyDictionary<string, string>>? answer = null) : IColumnMappingAdvisor
{
    public List<IReadOnlyList<ColumnSample>> Asked { get; } = [];

    public Task<IReadOnlyDictionary<string, string>> SuggestAsync(string entityType, IReadOnlyList<ColumnSample> columns,
        IReadOnlyList<EntityFieldDefinition> fields, CancellationToken ct = default)
    {
        Asked.Add(columns);
        return Task.FromResult(answer?.Invoke(columns) ?? new Dictionary<string, string>());
    }
}

public class ColumnMappingAdvisorTests
{
    private static Task<DetectionResult> Detect(SmartUploaderService uploader, string csv)
        => uploader.DetectAndMapAsync(new MemoryStream(Encoding.UTF8.GetBytes(csv)), "team.csv", "team", "7:s1");

    [Theory]
    [InlineData("jane.doe@acme.co.nz", "name@example.com")]
    [InlineData("Call +64 21 555 0199 after 5", "Call +99 99 999 9999 after 9")]
    [InlineData("1 Queen St, Auckland 1010", "9 Queen St, Auckland 9999")]
    [InlineData("Courier", "Courier")]
    public void Samples_lose_emails_and_digits_but_keep_their_shape(string value, string expected)
        => Assert.Equal(expected, SampleMasker.Mask(value));

    [Fact]
    public void Long_samples_are_cut_short()
        => Assert.Equal(SampleMasker.MaxLength, SampleMasker.Mask(new string('a', 500)).Length);

    [Fact]
    public async Task Only_columns_the_fuzzy_match_left_unmapped_are_sent_with_three_masked_samples()
    {
        var advisor = new FakeAdvisor();
        var uploader = new SmartUploaderService(advisor);

        await Detect(uploader, "Email,Zzq\njo@a.com,021 555 1\nam@b.com,021 555 2\n,\nli@c.com,021 555 3\nxx@d.com,021 555 4\n");

        var column = Assert.Single(Assert.Single(advisor.Asked));
        Assert.Equal("Zzq", column.Column);
        Assert.Equal(["999 999 9", "999 999 9", "999 999 9"], column.Values);
    }

    [Fact]
    public async Task A_suggestion_fills_the_column_and_is_marked_as_from_ai_below_full_confidence()
    {
        var uploader = new SmartUploaderService(new FakeAdvisor(_ => new Dictionary<string, string> { ["Zzq"] = "Mobile" }));

        var result = await Detect(uploader, "Email,Zzq\njo@a.com,021 555 1\n");

        var mapping = result.SuggestedMappings.Single(m => m.CsvColumn == "Zzq");
        Assert.Equal("Mobile", mapping.DfField);
        Assert.Equal(SuggestionSource.Ai, mapping.Source);
        Assert.InRange(mapping.Confidence, 1, 74);
        Assert.Null(result.SuggestedMappings.Single(m => m.CsvColumn == "Email").Source);
    }

    [Fact]
    public async Task A_suggestion_for_a_field_already_mapped_or_not_on_this_step_is_ignored()
    {
        var uploader = new SmartUploaderService(new FakeAdvisor(_ => new Dictionary<string, string>
        {
            ["Zzq"] = "Email",       // already taken by the Email column
            ["Qqz"] = "ZoneNumber"   // not a team field
        }));

        var result = await Detect(uploader, "Email,Zzq,Qqz\njo@a.com,x,y\n");

        Assert.All(result.SuggestedMappings.Where(m => m.CsvColumn != "Email"), m => Assert.Equal(string.Empty, m.DfField));
    }

    [Fact]
    public async Task A_failing_advisor_leaves_the_fuzzy_result_as_it_was()
    {
        var uploader = new SmartUploaderService(new FakeAdvisor(_ => throw new HttpRequestException("down")));

        var result = await Detect(uploader, "Email,Zzq\njo@a.com,x\n");

        Assert.True(result.Success);
        Assert.Equal("Email", result.SuggestedMappings.Single(m => m.CsvColumn == "Email").DfField);
        Assert.Equal(string.Empty, result.SuggestedMappings.Single(m => m.CsvColumn == "Zzq").DfField);
    }

    [Fact]
    public async Task Nothing_is_sent_when_every_column_matched()
    {
        var advisor = new FakeAdvisor();

        await Detect(new SmartUploaderService(advisor), "Email,First Name\njo@a.com,Jo\n");

        Assert.Empty(advisor.Asked);
    }

    [Fact]
    public void Model_answers_naming_unknown_columns_or_fields_or_a_field_twice_are_dropped()
    {
        var json = """
            {"mappings":[
              {"column":"Cell","field":"Mobile"},
              {"column":"Phone 2","field":"Mobile"},
              {"column":"Notes","field":""},
              {"column":"Ghost","field":"JobTitle"},
              {"column":"Role","field":"Nonsense"}
            ]}
            """;

        var parsed = ClaudeColumnMappingAdvisor.ParseSuggestions(json, ["Cell", "Phone 2", "Notes", "Role"], ["Mobile", "JobTitle"]);

        Assert.Equal(new Dictionary<string, string> { ["Cell"] = "Mobile" }, parsed);
    }

    [Fact]
    public void An_unreadable_model_answer_gives_no_suggestions()
        => Assert.Empty(ClaudeColumnMappingAdvisor.ParseSuggestions("not json", ["Cell"], ["Mobile"]));
}
