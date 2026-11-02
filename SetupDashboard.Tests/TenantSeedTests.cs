using System.Text.Json.Nodes;
using SetupDashboard.Models;
using SetupDashboard.Services.Steps;

namespace SetupDashboard.Tests;

/// <summary>What the tenant seed already did, read from the tenant. Suggestions only; a person confirms.</summary>
public class TenantSeedTests
{
    [Fact]
    public void Seeded_when_the_tenant_client_file_exists_and_the_address_is_the_tenants()
    {
        var s = new TblSetting { CompanyAddress = "12 Logistics Way, Sydney NSW 2000", AdminEmail = "ops@crisis.example" };

        Assert.True(TenantSeed.LooksDone(s, tenantClientFile: true));
        Assert.False(TenantSeed.LooksDone(s, tenantClientFile: false));
    }

    [Theory]
    [InlineData(null, "ops@crisis.example")]
    [InlineData("  ", "ops@crisis.example")]
    [InlineData("Urgent Couriers, 1 Main St, Auckland", "ops@crisis.example")]
    [InlineData("12 Logistics Way, Sydney", "helpdesk@urgent.co.nz")]
    public void Not_seeded_while_the_settings_are_blank_or_still_Urgents(string? address, string adminEmail)
        => Assert.False(TenantSeed.LooksDone(new TblSetting { CompanyAddress = address, AdminEmail = adminEmail }, tenantClientFile: true));

    [Fact]
    public void No_settings_row_is_not_seeded()
        => Assert.False(TenantSeed.LooksDone(null, tenantClientFile: true));

    [Fact]
    public void Only_the_tenants_own_roles_are_counted()
    {
        var roles = JsonNode.Parse("""
            [
              { "name": "Crisis Admin", "contactRoleId": 11, "tenantClientId": 84, "isActive": true },
              { "name": "Crisis Operations", "contactRoleId": 12, "tenantClientId": 84 },
              { "name": "Old role", "contactRoleId": 13, "tenantClientId": 84, "isActive": false },
              { "name": "Administrator", "contactRoleId": 1, "tenantClientId": null }
            ]
            """);

        Assert.Equal(2, TenantSeed.OwnRoleCount(roles));
        Assert.Null(TenantSeed.OwnRoleCount(null));
    }

    [Fact]
    public void The_seed_item_is_offered_but_not_required_and_identity_names_what_is_left()
    {
        var s = new SetupSession { TenantId = 7 };
        StepCatalog.Seed(s, _ => null);
        var business = s.Step(StepKeys.Business).Checklist;

        var seed = business.Single(c => c.Id == StepCatalog.TenantIdentitySeed);
        Assert.False(seed.Required);
        var identity = business.Single(c => c.Id == StepCatalog.TenantIdentity);
        Assert.True(identity.Required);
        Assert.Contains("Forgot Password", identity.Item);
        Assert.Contains("GST", identity.Item);
    }
}
