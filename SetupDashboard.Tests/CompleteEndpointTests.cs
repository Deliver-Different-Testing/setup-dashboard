using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Infrastructure;
using Microsoft.Extensions.Configuration;
using SetupDashboard.Controllers;
using SetupDashboard.Models;
using SetupDashboard.Services;
using SetupDashboard.Services.Steps;
using SetupDashboard.Services.TenantApps;

namespace SetupDashboard.Tests;

/// <summary>Who may mark a step done another way, and that a running send still blocks it.</summary>
public class CompleteEndpointTests
{
    private sealed class FixedAdminCheck(bool answer) : ITenantAdminCheck
    {
        public Task<bool> IsTenantAdminAsync(CallerContext caller, CancellationToken ct) => Task.FromResult(answer);
    }

    private static readonly StepCompleteBody Elsewhere = new("elsewhere", "Directly in Settings / Admin Manager", "Roles made in Settings");

    private static async Task<(SetupController Controller, DistributedSessionStore Store, InMemoryPushLock Lock, SetupSession Session)> Setup(
        int clientTypeId, bool tenantAdmin)
    {
        var store = new DistributedSessionStore(Make.Cache());
        var session = await store.CreateAsync(7, "cheetah", 42, "Dane");
        var pushLock = new InMemoryPushLock();
        var user = Make.User(clientTypeId: clientTypeId);
        var urls = new TenantAppUrls(new ConfigurationBuilder().Build(), Make.Http(user, ""), Make.Production());
        var controller = new SetupController(store, [], new StepPushRunner(store, pushLock, new FakeApps()), pushLock, urls,
            null!, null!, new FixedAdminCheck(tenantAdmin), new FakeApps())
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext { User = user } }
        };
        return (controller, store, pushLock, session);
    }

    private static int? Status(IActionResult r) => (r as IStatusCodeActionResult)?.StatusCode;

    [Fact]
    public async Task Tenant_staff_who_are_not_admins_cannot()
    {
        var (c, store, _, s) = await Setup(clientTypeId: 4, tenantAdmin: false);

        Assert.Equal(403, Status(await c.CompleteStep(s.Id, StepKeys.Team, Elsewhere, CancellationToken.None)));
        Assert.NotEqual(StepStatus.Done, (await store.GetAsync(7, s.Id))!.Step(StepKeys.Team).Status);
    }

    [Fact]
    public async Task A_tenant_admin_can()
    {
        var (c, store, _, s) = await Setup(clientTypeId: 4, tenantAdmin: true);

        Assert.Equal(200, Status(await c.CompleteStep(s.Id, StepKeys.Team, Elsewhere, CancellationToken.None)));
        var team = (await store.GetAsync(7, s.Id))!.Step(StepKeys.Team);
        Assert.Equal(StepStatus.Done, team.Status);
        Assert.Equal(StepCatalog.CompletedElsewhere, team.CompletedHow);
    }

    [Fact]
    public async Task DF_Admin_can_but_still_needs_a_note()
    {
        var (c, _, _, s) = await Setup(clientTypeId: 5, tenantAdmin: false);

        Assert.Equal(400, Status(await c.CompleteStep(s.Id, StepKeys.Team, Elsewhere with { Note = " " }, CancellationToken.None)));
        Assert.Equal(200, Status(await c.CompleteStep(s.Id, StepKeys.Team, Elsewhere, CancellationToken.None)));
    }

    [Fact]
    public async Task A_running_send_still_blocks_it()
    {
        var (c, _, pushLock, s) = await Setup(clientTypeId: 5, tenantAdmin: false);
        await using var held = await pushLock.TryAcquireAsync(StepPushRunner.LockKey(s), TimeSpan.FromMinutes(1));

        Assert.Equal(409, Status(await c.CompleteStep(s.Id, StepKeys.Team, Elsewhere, CancellationToken.None)));
    }

    [Fact]
    public async Task Without_a_body_the_usual_blockers_apply()
    {
        var (c, store, _, s) = await Setup(clientTypeId: 5, tenantAdmin: false);
        var stored = (await store.GetAsync(7, s.Id))!;
        StepCatalog.Seed(stored, _ => null);
        stored.Step(StepKeys.Clients).Rows.Add(new RowResult { Kind = "client", Key = "ACME", Status = RowStatus.Failed });
        await store.UpdateAsync(stored);

        Assert.Equal(409, Status(await c.CompleteStep(s.Id, StepKeys.Clients, null, CancellationToken.None)));
    }

    [Fact]
    public async Task Only_DFRNT_ticks_a_DFRNT_item_even_with_a_note()
    {
        var (c, store, _, s) = await Setup(clientTypeId: 4, tenantAdmin: true);

        Assert.Equal(403, Status(await c.TickChecklist(s.Id, StepKeys.Business, "depots", new ChecklistTick(true, "Made by hand"), CancellationToken.None)));
        var item = (await store.GetAsync(7, s.Id))!.Step(StepKeys.Business).Checklist.SingleOrDefault(x => x.Id == "depots");
        Assert.Null(item?.DoneAt);
    }

    [Fact]
    public async Task A_tick_note_is_saved()
    {
        var (c, store, _, s) = await Setup(clientTypeId: 5, tenantAdmin: false);

        Assert.Equal(200, Status(await c.TickChecklist(s.Id, StepKeys.Business, "depots", new ChecklistTick(true, "Made by hand"), CancellationToken.None)));
        Assert.Equal("Made by hand", (await store.GetAsync(7, s.Id))!.Step(StepKeys.Business).Checklist.Single(x => x.Id == "depots").Note);
    }
}
