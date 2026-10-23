using System.Text.Json.Nodes;
using SetupDashboard.Models;
using SetupDashboard.Services.Steps;
using SetupDashboard.Services.TenantApps;

namespace SetupDashboard.Tests;

public class StepPusherTests
{
    private static SetupSession Session(bool identityConfirmed = true)
    {
        var s = new SetupSession { TenantId = 7, TenantCode = "cheetah" };
        StepCatalog.Seed(s, _ => null);
        if (identityConfirmed)
            s.Step(StepKeys.Business).Checklist.Single(c => c.Id == StepCatalog.TenantIdentity).DoneAt = DateTime.UtcNow;
        return s;
    }

    private static ClientRow FullClient(string code = "ACME") => new()
    {
        Code = code, Name = "Acme Freight", Address = "1 Market St", Suburb = "Kansas City", City = "MO",
        InvoiceScheduleId = 1, PaymentTermId = 2, InviteConfirmed = true,
        PrimaryContact = new() { FirstName = "Ann", Email = "ann@acme.test" },
    };

    // ── Clients ──

    [Fact]
    public async Task A_customer_with_gaps_is_not_sent_and_says_what_it_needs()
    {
        var apps = new FakeApps();
        var s = Session();
        s.Clients.Add(new ClientRow { Code = "ACME", Name = "Acme" });

        await new ClientsPusher(apps).PushAsync(s, Make.Caller(country: "US"), default);

        Assert.Empty(apps.Posts("/api/v1/tenant/clients"));
        var row = s.Step(StepKeys.Clients).Rows.Single();
        Assert.Equal(RowStatus.NeedsData, row.Status);
        // US labels, as Settings shows them.
        Assert.Contains("city", row.Needs);
        Assert.Contains("state", row.Needs);
        Assert.Contains("invoice schedule", row.Needs);
        Assert.Contains("primary contact email", row.Needs);
    }

    [Fact]
    public async Task No_invented_values_are_sent()
    {
        var apps = new FakeApps { Respond = c => ApiResult.Success(c.App, 200, new JsonObject { ["id"] = 501 }) };
        var s = Session();
        s.Clients.Add(FullClient());

        await new ClientsPusher(apps).PushAsync(s, Make.Caller(), default);

        var body = apps.Posts("/api/v1/tenant/clients").Single().Body!.ToJsonString();
        foreach (var invented in new[] { "123 Main St", "10001", "\"NY\"", "Unknown", "Standard" })
            Assert.DoesNotContain(invented, body);
        Assert.Equal(RowStatus.Created, s.Step(StepKeys.Clients).Rows.Single().Status);
    }

    [Fact]
    public async Task A_second_push_does_not_resend_created_rows_even_if_an_earlier_row_failed()
    {
        var apps = new FakeApps
        {
            Respond = c => c.Body?["code"]?.GetValue<string>() == "BAD"
                ? ApiResult.Fail(c.App, 400, "A contact with email 'x' already exists.")
                : ApiResult.Success(c.App, 200, new JsonObject { ["id"] = 900 }),
        };
        var s = Session();
        s.Clients.Add(FullClient("BAD"));
        s.Clients.Add(FullClient("GOOD"));

        var pusher = new ClientsPusher(apps);
        await pusher.PushAsync(s, Make.Caller(), default);
        await pusher.PushAsync(s, Make.Caller(), default);

        var posted = apps.Posts("/api/v1/tenant/clients").Select(c => c.Body!["code"]!.GetValue<string>()).ToList();
        Assert.Equal(["BAD", "GOOD", "BAD"], posted); // GOOD once; the failed one retried
    }

    [Fact]
    public async Task Nobody_is_invited_until_the_tenants_settings_are_confirmed()
    {
        var apps = new FakeApps();
        var s = Session(identityConfirmed: false);
        s.Clients.Add(FullClient());

        await new ClientsPusher(apps).PushAsync(s, Make.Caller(), default);

        Assert.Empty(apps.Calls);
        Assert.Contains(s.Step(StepKeys.Clients).Rows.Single().Needs, n => n.Contains("system settings"));
    }

    [Fact]
    public async Task Customer_invite_must_be_ticked()
    {
        var apps = new FakeApps();
        var s = Session();
        var c = FullClient();
        c.InviteConfirmed = false;
        s.Clients.Add(c);

        await new ClientsPusher(apps).PushAsync(s, Make.Caller(), default);

        Assert.Empty(apps.Calls);
    }

    // ── Team ──

    private static FakeApps TeamApps(bool tenantClientExists = true) => new()
    {
        Respond = c => (c.Method, c.Path) switch
        {
            ("GET", var p) when p.StartsWith("/api/admin/contacts/lookups/clients") => ApiResult.Success(c.App, 200,
                tenantClientExists ? new JsonArray(new JsonObject { ["id"] = 77, ["name"] = "Cheetah Final Mile", ["clientTypeId"] = 4 }) : new JsonArray()),
            ("GET", "/api/admin/roles?clientType=4") => ApiResult.Success(c.App, 200, new JsonArray()),
            ("POST", "/api/admin/roles") => ApiResult.Success(c.App, 200, new JsonObject { ["contactRoleId"] = 9 }),
            ("POST", "/api/admin/contacts") => ApiResult.Success(c.App, 200, new JsonObject { ["id"] = 300, ["inviteNotice"] = "Contact added." }),
            _ => ApiResult.Success(c.App, 204, null),
        },
    };

    [Fact]
    public async Task Team_creates_a_tenant_staff_role_switches_tiles_on_and_adds_the_person_with_it()
    {
        var apps = TeamApps();
        var s = Session();
        s.Team.Roles.Add(new RoleRow { Name = "Cheetah Admin", Tiles = ["hub-tile-configurator", "hub-tile-booking"] });
        s.Team.People.Add(new PersonRow { Email = "ruth@cheetahfm.com", FirstName = "Ruth", LastName = "Correa", RoleName = "Cheetah Admin", InviteConfirmed = true });

        await new TeamPusher(apps).PushAsync(s, Make.Caller(clientTypeId: 5), default);

        var role = apps.Posts("/api/admin/roles").Single().Body!;
        Assert.Equal(4, role["clientTypeIds"]![0]!.GetValue<int>());
        Assert.Equal(77, role["tenantClientId"]!.GetValue<int>());

        var tiles = apps.Calls.Where(c => c.Method == "PUT").Select(c => c.Path).ToList();
        Assert.Equal(["/api/v1/tenant/tile-access/roles/9/hub-tile-configurator", "/api/v1/tenant/tile-access/roles/9/hub-tile-booking"], tiles);

        var person = apps.Posts("/api/admin/contacts").Single().Body!;
        Assert.Equal(77, person["clientId"]!.GetValue<int>());
        Assert.Equal(9, person["roleIds"]![0]!.GetValue<int>());
    }

    [Fact]
    public async Task Team_never_touches_legacy_user_or_staff_endpoints()
    {
        var apps = TeamApps();
        var s = Session();
        s.Team.Roles.Add(new RoleRow { Name = "Ops" });
        s.Team.People.Add(new PersonRow { Email = "a@b.test", FirstName = "A", RoleName = "Ops", InviteConfirmed = true });

        await new TeamPusher(apps).PushAsync(s, Make.Caller(), default);

        Assert.DoesNotContain(apps.Calls, c => c.Path.Contains("/API/User", StringComparison.OrdinalIgnoreCase)
                                                || c.Path.Contains("staff", StringComparison.OrdinalIgnoreCase));
        Assert.All(apps.Calls, c => Assert.Equal(TenantApp.Settings, c.App));
    }

    [Fact]
    public async Task Without_the_tenant_client_file_people_wait_instead_of_landing_somewhere_else()
    {
        var apps = TeamApps(tenantClientExists: false);
        var s = Session();
        s.Team.Roles.Add(new RoleRow { Name = "Ops" });
        s.Team.People.Add(new PersonRow { Email = "a@b.test", FirstName = "A", RoleName = "Ops", InviteConfirmed = true });

        await new TeamPusher(apps).PushAsync(s, Make.Caller(), default);

        Assert.Empty(apps.Posts("/api/admin/contacts"));
        var person = s.Step(StepKeys.Team).Rows.Single(r => r.Kind == TeamPusher.PersonKind);
        Assert.Contains(person.Needs, n => n.Contains("tenant's own client file"));
    }

    [Fact]
    public async Task Tenant_admins_create_roles_owned_by_their_claim_not_a_chosen_client()
    {
        var apps = TeamApps();
        var s = Session();
        s.Team.Roles.Add(new RoleRow { Name = "Ops" });

        await new TeamPusher(apps).PushAsync(s, Make.Caller(clientTypeId: 4), default);

        Assert.Null(apps.Posts("/api/admin/roles").Single().Body!["tenantClientId"]);
    }

    // ── Rates ──

    [Fact]
    public async Task Rates_always_send_the_client_list_and_resolve_names_to_ids()
    {
        var apps = new FakeApps
        {
            Respond = c => (c.Method, c.Path) switch
            {
                ("GET", "/api/v1/tenant/lookups/vehicle-sizes") => ApiResult.Success(c.App, 200, new JsonArray(new JsonObject { ["id"] = 3, ["name"] = "Van" })),
                ("GET", "/api/v1/tenant/lookups/zone-names") => ApiResult.Success(c.App, 200, new JsonArray()),
                ("POST", "/api/v1/tenant/pricing/zone-names") => ApiResult.Success(c.App, 200, new JsonObject { ["id"] = c.Body!["name"]!.GetValue<string>() == "Z1" ? 11 : 12 }),
                _ => ApiResult.Success(c.App, 200, new JsonObject { ["id"] = 50 }),
            },
        };
        var s = Session();
        s.Rates.ZoneGroups.Add(new ZoneGroupRow { Name = "KC", Zones = [new() { Name = "Z1", Zips = ["64101"] }, new() { Name = "Z2" }] });
        s.Rates.ZoneRates.Add(new ZoneRateRow { Name = "Z1-Z2 Van", FromZone = "Z1", ToZone = "Z2", SpeedId = 1, VehicleSizeNames = ["Van"], ChargeRate = 25m, DriverRate = 15m });

        await new RatesPusher(apps).PushAsync(s, Make.Caller(), default);

        var rate = apps.Posts("/api/v1/tenant/pricing/zone-rates").Single().Body!;
        Assert.NotNull(rate["clientIds"]); // explicit [] = all customers, never omitted
        Assert.Empty(rate["clientIds"]!.AsArray());
        Assert.Equal(11, rate["fromZoneNameId"]!.GetValue<int>());
        Assert.Equal(12, rate["toZoneNameId"]!.GetValue<int>());
        Assert.Equal(3, rate["vehicleIds"]![0]!.GetValue<int>());
        Assert.Equal("Applies to every customer.", s.Step(StepKeys.Rates).Rows.Single(r => r.Kind == RatesPusher.ZoneRateKind).Notice);
    }

    [Fact]
    public async Task Percentages_are_sent_as_fractions()
    {
        var apps = new FakeApps();
        var s = Session();
        s.Rates.VehicleSizes.Add(new VehicleSizeRow { Name = "Van", FuelPercent = 12.5m });

        await new RatesPusher(apps).PushAsync(s, Make.Caller(), default);

        Assert.Equal(0.125m, apps.Posts("/api/v1/tenant/pricing/vehicle-sizes").Single().Body!["fuelPercentage"]!.GetValue<decimal>());
    }

    // ── Schedules ──

    [Fact]
    public void Client_address_schedules_need_an_origin_depot_and_a_customer()
    {
        var needs = SchedulesPusher.Validate(new ScheduleRow
        {
            Name = "KC Daily", RegionId = 1, OriginType = "client",
            DayWindows = [new() { DayOfWeek = 1, StartTime = "09:00", EndTime = "17:00" }],
        });
        Assert.Contains(needs.Items, n => n.StartsWith("origin depot"));
        Assert.Contains(needs.Items, n => n.StartsWith("at least one customer"));
    }

    [Fact]
    public void Day_windows_are_checked()
    {
        var needs = SchedulesPusher.Validate(new ScheduleRow
        {
            Name = "x", RegionId = 1, OriginType = "direct",
            DayWindows = [new() { DayOfWeek = 8, StartTime = "9am", EndTime = "17:00" }, new() { DayOfWeek = 8, StartTime = "09:00", EndTime = "10:00" }],
        });
        Assert.Contains("day for window 1", needs.Items);
        Assert.Contains("start time (HH:mm) for window 1", needs.Items);
        Assert.Contains("one window per day", needs.Items);
    }

    // ── Couriers ──

    [Fact]
    public async Task Courier_passwords_are_cleared_once_the_login_exists()
    {
        var apps = new FakeApps();
        var s = Session();
        s.Couriers.Couriers.Add(new CourierRow { FirstName = "Sam", SurName = "Lee", Email = "sam@x.test", InitialPassword = "correct-horse" });

        await new CouriersPusher(apps).PushAsync(s, Make.Caller(), default);

        Assert.Equal("correct-horse", apps.Posts("/api/v1/np/fleet").Single().Body!["password"]!.GetValue<string>());
        Assert.Null(s.Couriers.Couriers.Single().InitialPassword);
    }

    [Fact]
    public void A_courier_without_a_typed_password_is_not_sent()
        => Assert.Contains(CouriersPusher.Validate(new CourierRow { FirstName = "a", SurName = "b", Email = "c@d" }).Items,
            n => n.StartsWith("initial app password"));
}
