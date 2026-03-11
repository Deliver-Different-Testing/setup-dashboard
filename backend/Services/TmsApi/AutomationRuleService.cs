using SetupDashboard.Models.TmsApi;

namespace SetupDashboard.Services.TmsApi;

/// <summary>
/// Automation Rule Management — 7+ tools from automation-rules.ts.
/// 
/// QUIRKS:
///   - Update response always shows empty conditions/actions (display bug, not failure)
///   - Always pass BOTH conditions AND actions in update — omitting either clears it
///   - Verify with GetAutomationRule after any update
/// </summary>
public class AutomationRuleService : TmsServiceBase
{
    public AutomationRuleService(AdminManagerClient client) : base(client) { }

    public async Task<List<TmsAutomationRule>> ListAutomationRulesAsync()
    {
        var json = await GetRawAsync("/api/automationRules");
        return ExtractArray<TmsAutomationRule>(json, "rules");
    }

    public async Task<string> GetAutomationRuleAsync(int ruleId)
        => await GetRawAsync($"/api/automationRules/{ruleId}");

    public async Task<string> CreateAutomationRuleAsync(Dictionary<string, object?> payload)
        => await Client.PostRawAsync("/api/automationRules", payload);

    /// <summary>
    /// Update automation rule. IMPORTANT: Always include both conditions and actions.
    /// </summary>
    public async Task<string> UpdateAutomationRuleAsync(int ruleId, Dictionary<string, object?> updates)
    {
        var json = await GetRawAsync($"/api/automationRules/{ruleId}");
        var current = UnwrapEntity(json, "rule");
        var payload = new Dictionary<string, object?>
        {
            ["id"] = ruleId,
            ["name"] = updates.GetValueOrDefault("name") ?? current.GetValueOrDefault("name"),
            ["description"] = updates.GetValueOrDefault("description") ?? current.GetValueOrDefault("description"),
            ["isActive"] = current.GetValueOrDefault("isActive"),
            ["conditions"] = updates.GetValueOrDefault("conditions") ?? current.GetValueOrDefault("conditions"),
            ["actions"] = updates.GetValueOrDefault("actions") ?? current.GetValueOrDefault("actions"),
        };
        return await Client.PostRawAsync($"/api/automationRules/{ruleId}", payload);
    }

    public async Task DeleteAutomationRuleAsync(int ruleId)
        => await Client.DeleteAsync($"/api/automationRules/{ruleId}");

    public async Task<string> ToggleAutomationRuleAsync(int ruleId)
        => await Client.PostRawAsync($"/api/automationRules/{ruleId}/toggle", new { });

    public async Task<string> ListAutomationConfigurationsAsync()
        => await GetRawAsync("/api/automationRules/configurations");
}
