using SetupDashboard.Models.TmsApi;

namespace SetupDashboard.Services.TmsApi;

/// <summary>
/// Holiday Management — 6 tools from holidays.ts.
/// Uses /API/holiday (capital API).
/// </summary>
public class HolidayService : TmsServiceBase
{
    public HolidayService(AdminManagerClient client) : base(client) { }

    public async Task<List<Holiday>> SearchHolidaysAsync(string searchText = " ")
    {
        var json = await Client.PostRawAsync("/API/holiday/search", new { searchText });
        return ExtractArray<Holiday>(json, "holidays");
    }

    public async Task<string> GetHolidayAsync(int holidayId)
        => await GetRawAsync($"/API/holiday/{holidayId}");

    public async Task<string> CreateHolidayAsync(Dictionary<string, object?> fields)
    {
        if (!fields.ContainsKey("allSpeeds")) fields["allSpeeds"] = true;
        if (!fields.ContainsKey("amount")) fields["amount"] = 0;
        return await Client.PostRawAsync("/API/holiday", fields);
    }

    public async Task<string> UpdateHolidayAsync(int holidayId, Dictionary<string, object?> updates)
        => await UpdateEntityAsync("/API/holiday", holidayId, "holiday", updates);

    public async Task DeleteHolidayAsync(int holidayId)
        => await Client.DeleteAsync($"/API/holiday/{holidayId}");

    public async Task<BulkOperationResult> BulkCreateHolidaysAsync(List<Dictionary<string, object?>> holidays)
    {
        var items = holidays.Select(h =>
        {
            if (!h.ContainsKey("allSpeeds")) h["allSpeeds"] = true;
            if (!h.ContainsKey("amount")) h["amount"] = 0;
            return (object)h;
        }).ToList();
        return await BulkCreateAsync("/API/holiday", items, new BulkOptions { BatchSize = 50, DelayMs = 100 });
    }
}
