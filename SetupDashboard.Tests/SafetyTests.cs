using System.Reflection;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using SetupDashboard.Controllers;
using SetupDashboard.Core.Domain;
using SetupDashboard.Models;
using SetupDashboard.Services;
using SetupDashboard.Services.Steps;

namespace SetupDashboard.Tests;

public class SafetyTests
{
    [Fact]
    public void No_controller_or_action_is_anonymous()
    {
        var controllers = typeof(SetupController).Assembly.GetTypes()
            .Where(t => typeof(ControllerBase).IsAssignableFrom(t) && !t.IsAbstract).ToList();
        Assert.NotEmpty(controllers);

        var anonymous = controllers
            .SelectMany(t => new[] { (MemberInfo)t }.Concat(t.GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly)))
            .Where(m => m.GetCustomAttribute<AllowAnonymousAttribute>() != null)
            .Select(m => $"{m.DeclaringType?.Name}.{m.Name}")
            .ToList();
        Assert.Empty(anonymous);
    }

    [Fact]
    public async Task The_tenant_database_context_cannot_write()
    {
        var options = new DbContextOptionsBuilder<DespatchContext>()
            .UseSqlServer("Server=unused;Database=unused;").Options;
        await using var db = new DynamicDespatchDbContext(options);

        db.TucStaffs.Add(new TucStaff());
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => db.SaveChangesAsync());
        Assert.Equal(DynamicDespatchDbContext.ReadOnlyMessage, ex.Message);
        Assert.Throws<InvalidOperationException>(() => db.SaveChanges());
    }

    [Fact]
    public async Task Sessions_belong_to_one_tenant()
    {
        var store = new DistributedSessionStore(Make.Cache(), NullLogger<DistributedSessionStore>.Instance);
        var mine = await store.CreateAsync(7, "cheetah", 42, "Dane");

        Assert.NotNull(await store.GetAsync(7, mine.Id));
        Assert.Null(await store.GetAsync(8, mine.Id));
        Assert.Empty(await store.ListAsync(8));
        Assert.False(await store.DeleteAsync(8, mine.Id));
        Assert.Single(await store.ListAsync(7));
    }

    [Fact]
    public void Courier_passwords_never_reach_the_browser()
    {
        var s = new SetupSession { TenantId = 7 };
        s.Couriers.Couriers.Add(new CourierRow { Email = "a@b", InitialPassword = "secret-123" });

        var json = System.Text.Json.JsonSerializer.Serialize(SetupController.View(s));

        Assert.DoesNotContain("secret-123", json);
        Assert.Contains("\"hasInitialPassword\":true", json);
    }

    [Fact]
    public void A_blank_password_from_the_browser_keeps_the_stored_one()
    {
        var stored = new CouriersStep { Couriers = [new() { Email = "a@b", InitialPassword = "secret-123" }] };
        var incoming = new CouriersStep { Couriers = [new() { Email = "A@B ", FirstName = "Al" }] };

        var merged = SetupController.MergeCouriers(stored, incoming);

        Assert.Equal("secret-123", merged.Couriers.Single().InitialPassword);
        Assert.Equal("Al", merged.Couriers.Single().FirstName);
    }

    [Fact]
    public void A_step_with_failures_or_open_requests_cannot_be_marked_done()
    {
        var s = new SetupSession { TenantId = 7 };
        StepCatalog.Seed(s, _ => null);
        var clients = s.Step(StepKeys.Clients);

        clients.Rows.Add(new RowResult { Kind = "client", Key = "A", Status = RowStatus.Failed });
        Assert.NotNull(StepCatalog.CompleteBlocker(s, StepKeys.Clients));

        clients.Rows.Clear();
        clients.Requests.Add(new DataRequest { Item = "Customer list" });
        StepCatalog.Recompute(s, StepKeys.Clients, hasData: false);
        Assert.Equal(StepStatus.WaitingOnTenant, clients.Status);
        Assert.NotNull(StepCatalog.CompleteBlocker(s, StepKeys.Clients));

        clients.Requests[0].FulfilledAt = DateTime.UtcNow;
        Assert.Null(StepCatalog.CompleteBlocker(s, StepKeys.Clients));
    }

    [Fact]
    public void Seeding_adds_new_checklist_items_without_losing_ticks()
    {
        var s = new SetupSession { TenantId = 7 };
        StepCatalog.Seed(s, _ => null);
        var item = s.Step(StepKeys.Business).Checklist.Single(c => c.Id == StepCatalog.Depots);
        item.DoneAt = DateTime.UtcNow;
        s.Step(StepKeys.Business).Checklist.RemoveAll(c => c.Id == "logo");

        StepCatalog.Seed(s, _ => null);

        Assert.NotNull(s.Step(StepKeys.Business).Checklist.Single(c => c.Id == StepCatalog.Depots).DoneAt);
        Assert.Contains(s.Step(StepKeys.Business).Checklist, c => c.Id == "logo");
    }

    [Theory]
    [InlineData("Ruth Correa", null, "Ruth", "Correa")]
    [InlineData("Ruth", "Correa", "Ruth", "Correa")]
    [InlineData("Cher", null, "Cher", null)]
    public void Single_name_columns_are_split(string first, string? last, string expFirst, string? expLast)
        => Assert.Equal((expFirst, expLast), ImportController.SplitName(first, last));
}
