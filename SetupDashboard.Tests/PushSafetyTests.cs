using System.Text.Json.Nodes;
using Microsoft.Extensions.Logging.Abstractions;
using SetupDashboard.Models;
using SetupDashboard.Services;
using SetupDashboard.Services.Steps;
using SetupDashboard.Services.TenantApps;

namespace SetupDashboard.Tests;

/// <summary>
/// A push must never write the same record twice and never reach outside the tenant:
/// roles stay the tenant's own, created ids survive an interrupted push, and a write
/// that got no answer is not blindly re-sent.
/// </summary>
public class PushSafetyTests
{
    private static SetupSession Session()
    {
        var s = new SetupSession { TenantId = 7, TenantCode = "cheetah" };
        StepCatalog.Seed(s, _ => null);
        s.Step(StepKeys.Business).Checklist.Single(c => c.Id == StepCatalog.TenantIdentity).DoneAt = DateTime.UtcNow;
        return s;
    }

    private static ClientRow Client(string code) => new()
    {
        Code = code, Name = $"{code} Freight", Address = "1 Market St", Suburb = "Kansas City", City = "MO",
        InvoiceScheduleId = 1, PaymentTermId = 2, InviteConfirmed = true,
        PrimaryContact = new() { FirstName = "Ann", Email = $"ann@{code}.test" },
    };

    private static FakeApps TeamApps(JsonArray existingRoles, bool tenantClientExists = true) => new()
    {
        Respond = c => (c.Method, c.Path) switch
        {
            ("GET", var p) when p.StartsWith("/api/admin/contacts/lookups/clients") => ApiResult.Success(c.App, 200,
                tenantClientExists ? new JsonArray(new JsonObject { ["id"] = 77, ["name"] = "Cheetah", ["clientTypeId"] = 4 }) : new JsonArray()),
            ("GET", var p) when p.StartsWith("/api/admin/roles") => ApiResult.Success(c.App, 200, existingRoles),
            ("POST", "/api/admin/roles") => ApiResult.Success(c.App, 200, new JsonObject { ["contactRoleId"] = 9 }),
            _ => ApiResult.Success(c.App, 204, null),
        },
    };

    // ── Roles stay the tenant's own ──

    [Fact]
    public async Task A_global_default_role_with_the_same_name_is_never_reused_or_given_tiles()
    {
        var apps = TeamApps(new JsonArray(new JsonObject { ["contactRoleId"] = 1, ["name"] = "Dispatcher", ["tenantClientId"] = null, ["isActive"] = true }));
        var s = Session();
        s.Team.Roles.Add(new RoleRow { Name = "Dispatcher", Tiles = ["hub-tile-despatch"] });

        await new TeamPusher(apps).PushAsync(s, Make.Caller(clientTypeId: 5), default);

        Assert.Single(apps.Posts("/api/admin/roles"));
        Assert.DoesNotContain(apps.Calls, c => c.Path.StartsWith("/api/v1/tenant/tile-access/roles/1/"));
        Assert.Contains(apps.Calls, c => c.Method == "PUT" && c.Path == "/api/v1/tenant/tile-access/roles/9/hub-tile-despatch");
    }

    [Fact]
    public async Task A_role_this_tenant_already_owns_is_reused()
    {
        var apps = TeamApps(new JsonArray(new JsonObject { ["contactRoleId"] = 5, ["name"] = "Dispatcher", ["tenantClientId"] = 77, ["isActive"] = true }));
        var s = Session();
        s.Team.Roles.Add(new RoleRow { Name = "Dispatcher", Tiles = ["hub-tile-despatch"] });

        await new TeamPusher(apps).PushAsync(s, Make.Caller(clientTypeId: 5), default);

        Assert.Empty(apps.Posts("/api/admin/roles"));
        Assert.Contains(apps.Calls, c => c.Method == "PUT" && c.Path == "/api/v1/tenant/tile-access/roles/5/hub-tile-despatch");
    }

    [Fact]
    public async Task DF_Admin_without_the_tenant_client_file_does_not_create_a_global_role()
    {
        var apps = TeamApps(new JsonArray(), tenantClientExists: false);
        var s = Session();
        s.Team.Roles.Add(new RoleRow { Name = "Ops" });

        await new TeamPusher(apps).PushAsync(s, Make.Caller(clientTypeId: 5), default);

        Assert.Empty(apps.Posts("/api/admin/roles"));
        Assert.Equal(RowStatus.NeedsData, s.Step(StepKeys.Team).Rows.Single(r => r.Kind == TeamPusher.RoleKind).Status);
    }

    // ── Zones ──

    [Fact]
    public async Task The_same_zone_name_in_two_groups_is_two_zones()
    {
        var next = 10;
        var apps = new FakeApps { Respond = c => ApiResult.Success(c.App, 200, c.Method == "GET" ? new JsonArray() : new JsonObject { ["id"] = ++next }) };
        var s = Session();
        s.Rates.ZoneGroups.Add(new ZoneGroupRow { Name = "KC", Zones = [new() { Name = "Downtown", Zips = ["64101"] }] });
        s.Rates.ZoneGroups.Add(new ZoneGroupRow { Name = "STL", Zones = [new() { Name = "Downtown", Zips = ["63101"] }] });

        await new RatesPusher(apps).PushAsync(s, Make.Caller(), default);

        Assert.Equal(2, apps.Posts("/api/v1/tenant/pricing/zone-names").Count());
        var zipZones = apps.Posts("/api/v1/tenant/pricing/zone-zips").Select(c => c.Body!["zoneNameId"]!.GetValue<int>()).ToList();
        Assert.Equal(2, zipZones.Distinct().Count());
    }

    // ── A write with no answer ──

    [Fact]
    public async Task A_write_that_got_no_answer_is_not_resent_and_blocks_completion_until_retried()
    {
        var calls = 0;
        var apps = new FakeApps
        {
            Respond = c => c.Method == "POST" && ++calls == 1
                ? ApiResult.NoAnswer(c.App)
                : ApiResult.Success(c.App, 200, new JsonObject { ["id"] = 501 }),
        };
        var s = Session();
        s.Clients.Add(Client("ACME"));
        var pusher = new ClientsPusher(apps);

        await pusher.PushAsync(s, Make.Caller(), default);
        var row = s.Step(StepKeys.Clients).Rows.Single();
        Assert.Equal(RowStatus.Unknown, row.Status);

        await pusher.PushAsync(s, Make.Caller(), default);
        Assert.Single(apps.Posts("/api/v1/tenant/clients"));
        Assert.NotNull(StepCatalog.CompleteBlocker(s, StepKeys.Clients));

        Assert.True(RowLedger.Retry(s.Step(StepKeys.Clients), ClientsPusher.ClientKind, "ACME"));
        await pusher.PushAsync(s, Make.Caller(), default);
        Assert.Equal(2, apps.Posts("/api/v1/tenant/clients").Count());
        Assert.Equal(RowStatus.Created, row.Status);
    }

    // ── Rows for records that were edited away ──

    [Fact]
    public void Rows_not_touched_by_a_push_are_dropped_unless_they_were_created()
    {
        var step = new StepState { Key = StepKeys.Clients };
        var old = DateTime.UtcNow.AddMinutes(-5);
        step.Rows.Add(new RowResult { Kind = "client", Key = "OLD", Status = RowStatus.NeedsData, UpdatedAt = old });
        step.Rows.Add(new RowResult { Kind = "client", Key = "MADE", Status = RowStatus.Created, UpdatedAt = old });
        step.Rows.Add(new RowResult { Kind = "client", Key = "LOST", Status = RowStatus.Unknown, UpdatedAt = old });
        var started = DateTime.UtcNow;
        step.Rows.Add(new RowResult { Kind = "client", Key = "NEW", Status = RowStatus.Failed, UpdatedAt = started.AddSeconds(1) });

        RowLedger.PruneStale(step, started);

        Assert.Equal(["MADE", "LOST", "NEW"], step.Rows.Select(r => r.Key));
    }

    // ── Courier passwords ──

    [Fact]
    public async Task A_courier_password_is_cleared_once_it_has_been_sent_even_if_the_create_failed()
    {
        var apps = new FakeApps { Respond = c => ApiResult.Fail(c.App, 400, "A Master user with that email already exists.") };
        var s = Session();
        s.Couriers.Couriers.Add(new CourierRow { FirstName = "Sam", SurName = "Lee", Email = "sam@x.test", InitialPassword = "correct-horse" });

        await new CouriersPusher(apps).PushAsync(s, Make.Caller(), default);

        Assert.Single(apps.Posts("/api/v1/np/fleet"));
        Assert.Null(s.Couriers.Couriers.Single().InitialPassword);
    }

    // ── The runner: one push at a time, progress saved as it goes ──

    private static (StepPushRunner Runner, DistributedSessionStore Store, InMemoryPushLock Lock) Runner(FakeApps apps)
    {
        var store = new DistributedSessionStore(Make.Cache(), NullLogger<DistributedSessionStore>.Instance);
        var pushLock = new InMemoryPushLock();
        return (new StepPushRunner(store, pushLock, apps), store, pushLock);
    }

    [Fact]
    public async Task Created_ids_are_saved_before_the_next_write_and_kept_when_the_push_dies()
    {
        var apps = new FakeApps();
        var (runner, store, _) = Runner(apps);
        var s = await store.CreateAsync(7, "cheetah", 42, "Dane");
        StepCatalog.Seed(s, _ => null);
        s.Step(StepKeys.Business).Checklist.Single(c => c.Id == StepCatalog.TenantIdentity).DoneAt = DateTime.UtcNow;
        s.Clients.Add(Client("ONE"));
        s.Clients.Add(Client("TWO"));

        string? firstRowSeenBySecondWrite = null;
        var posts = 0;
        apps.Respond = c =>
        {
            if (c.Method != "POST") return ApiResult.Success(c.App, 200, null);
            if (++posts == 1) return ApiResult.Success(c.App, 200, new JsonObject { ["id"] = 501 });
            var saved = store.GetAsync(7, s.Id).GetAwaiter().GetResult()!;
            firstRowSeenBySecondWrite = saved.Step(StepKeys.Clients).Rows.Single(r => r.Key == "ONE").Status;
            throw new InvalidOperationException("pod restarted");
        };

        await Assert.ThrowsAsync<InvalidOperationException>(() => runner.RunAsync(s, Make.Caller(), new ClientsPusher(apps)));

        Assert.Equal(RowStatus.Created, firstRowSeenBySecondWrite);
        var after = (await store.GetAsync(7, s.Id))!;
        Assert.Equal(501, after.Step(StepKeys.Clients).Rows.Single(r => r.Key == "ONE").EntityId);
    }

    [Fact]
    public async Task A_second_push_on_the_same_session_is_refused_while_one_is_running()
    {
        var apps = new FakeApps();
        var (runner, store, pushLock) = Runner(apps);
        var s = await store.CreateAsync(7, "cheetah", 42, "Dane");
        s.Clients.Add(Client("ONE"));

        await using (await pushLock.TryAcquireAsync(StepPushRunner.LockKey(s), TimeSpan.FromMinutes(1)))
        {
            var outcome = await runner.RunAsync(s, Make.Caller(), new ClientsPusher(apps));
            Assert.False(outcome.Ran);
        }
        Assert.Empty(apps.Calls);
        Assert.True((await runner.RunAsync(s, Make.Caller(), new ClientsPusher(apps))).Ran);
    }
}
