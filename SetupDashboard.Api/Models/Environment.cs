namespace SetupDashboard.Models;

/// <summary>
/// One deployment's app addresses, from <c>Environments__&lt;key&gt;__*</c> settings
/// (e.g. <c>Environments__local__HubLoginUrl</c>). The first six are the pre-rewrite shape;
/// the last three are the apps the dashboard now writes through.
/// </summary>
public class DfrntEnvironment
{
    public string Name { get; set; } = string.Empty;

    /// <summary>Admin Manager.</summary>
    public string BaseUrl { get; set; } = string.Empty;

    public string HubUrl { get; set; } = string.Empty;
    public string HubLoginUrl { get; set; } = string.Empty;
    public string DispatchUrl { get; set; } = string.Empty;
    public string ApiUrl { get; set; } = string.Empty;

    /// <summary>Settings (dfrntdrive_configurator).</summary>
    public string SettingsUrl { get; set; } = string.Empty;

    public string RoutedOpsUrl { get; set; } = string.Empty;
    public string IntegrationManagerUrl { get; set; } = string.Empty;

    /// <summary>Customer Success Platform (dfrntcrm), which answers Auto-Mate questions.</summary>
    public string CspUrl { get; set; } = string.Empty;
}
