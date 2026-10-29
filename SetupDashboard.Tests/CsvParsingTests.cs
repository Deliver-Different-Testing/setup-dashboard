using System.Text;
using SetupDashboard.Services;

namespace SetupDashboard.Tests;

public class CsvParsingTests
{
    private static Task<(List<string> Headers, List<string[]> Rows)> Parse(string csv, bool bom = false)
    {
        var bytes = Encoding.UTF8.GetBytes(csv);
        if (bom) bytes = Encoding.UTF8.GetPreamble().Concat(bytes).ToArray();
        return new SmartUploaderService().ParseFileAsync(new MemoryStream(bytes), "clients.csv");
    }

    [Fact]
    public async Task Reads_header_and_rows_trimming_whitespace()
    {
        var (headers, rows) = await Parse("Code , Name\r\n A1 ,  Acme Ltd \r\nB2,Bravo\r\n");

        Assert.Equal(["Code", "Name"], headers);
        Assert.Equal(2, rows.Count);
        Assert.Equal(["A1", "Acme Ltd"], rows[0]);
        Assert.Equal(["B2", "Bravo"], rows[1]);
    }

    [Fact]
    public async Task Quoted_fields_keep_commas_and_escaped_quotes()
    {
        var (_, rows) = await Parse("Name,Address\n\"Acme, Ltd\",\"1 \"\"Main\"\" St\"\n");

        Assert.Equal(["Acme, Ltd", "1 \"Main\" St"], Assert.Single(rows));
    }

    [Fact]
    public async Task Short_rows_are_padded_with_empty_strings()
    {
        var (_, rows) = await Parse("A,B,C\n1\n1,2,3,4\n");

        Assert.Equal(["1", "", ""], rows[0]);
        Assert.Equal(["1", "2", "3"], rows[1]);
    }

    [Fact]
    public async Task Byte_order_mark_is_not_part_of_the_first_header()
    {
        var (headers, _) = await Parse("Code,Name\nA1,Acme\n", bom: true);

        Assert.Equal("Code", headers[0]);
    }

    [Fact]
    public async Task Malformed_quoting_does_not_throw()
    {
        var (_, rows) = await Parse("Name,Note\nAcme,5\" pipe\nBravo,ok\n");

        Assert.Equal(2, rows.Count);
        Assert.Equal("Bravo", rows[1][0]);
    }
}
