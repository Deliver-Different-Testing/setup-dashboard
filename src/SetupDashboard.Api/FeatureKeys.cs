namespace SetupDashboard;

/// <summary>
/// Access Control switch keys this app enforces (dbo.Feature, seeded by
/// dbmigrationsv2 20261015100000_HubTileSetupDashboard).
/// </summary>
public static class FeatureKeys
{
    /// <summary>The Hub tile switch. Off = no tile AND no access.</summary>
    public const string SetupDashboard = "hub-tile-setup-dashboard";
}
