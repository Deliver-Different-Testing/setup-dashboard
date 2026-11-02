using System.Text.Json;
using SetupDashboard.Models;
using SetupDashboard.Services;
using SetupDashboard.Services.Steps;

namespace SetupDashboard.Tests;

/// <summary>A step finished outside the dashboard (Settings, Admin Manager, Claude) is marked done with a note.</summary>
public class DoneAnotherWayTests
{
    private static SetupSession Session()
    {
        var s = new SetupSession { TenantId = 7, TenantCode = "crisis" };
        StepCatalog.Seed(s, _ => null);
        return s;
    }

    [Fact]
    public void Done_another_way_skips_the_blocker_and_records_how()
    {
        var s = Session();
        var rates = s.Step(StepKeys.Rates);
        rates.Requests.Add(new DataRequest { Item = "Rate sheet" });
        rates.Rows.Add(new RowResult { Kind = "zone", Key = "CBD", Status = RowStatus.Failed });
        rates.Rows.Add(new RowResult { Kind = "zone", Key = "North", Status = RowStatus.Created, EntityId = 3 });
        Assert.NotNull(StepCatalog.CompleteBlocker(s, StepKeys.Rates));

        StepCatalog.CompleteElsewhere(s, StepKeys.Rates, "Steve", "Loaded by Claude or the MCP", "RK1 loaded on prod 31 Oct");

        Assert.Equal(StepStatus.Done, rates.Status);
        Assert.Equal(StepCatalog.CompletedElsewhere, rates.CompletedHow);
        Assert.Equal("Loaded by Claude or the MCP", rates.CompletedMethod);
        Assert.Equal("RK1 loaded on prod 31 Oct", rates.CompletedNote);
        Assert.Equal("Steve", rates.CompletedBy);
        Assert.NotNull(rates.CompletedAt);

        var request = rates.Requests.Single();
        Assert.NotNull(request.FulfilledAt);
        Assert.Equal("Steve", request.FulfilledBy);
        Assert.Equal("RK1 loaded on prod 31 Oct", request.FulfilledNote);

        Assert.Equal(RowStatus.Skipped, rates.Rows.Single(r => r.Key == "CBD").Status);
        Assert.Equal(RowStatus.Created, rates.Rows.Single(r => r.Key == "North").Status);
    }

    [Fact]
    public void Required_checklist_items_are_left_as_they_are()
    {
        var s = Session();

        StepCatalog.CompleteElsewhere(s, StepKeys.Business, "Steve", "Directly in Settings / Admin Manager", "Done in Admin Manager");

        var business = s.Step(StepKeys.Business);
        Assert.Equal(StepStatus.Done, business.Status);
        Assert.All(business.Checklist, c => Assert.Null(c.DoneAt));
    }

    [Fact]
    public void Marking_the_last_step_completes_the_session_either_way()
    {
        var s = Session();
        foreach (var key in StepKeys.All.Where(k => k != StepKeys.Training))
        {
            StepCatalog.CompleteElsewhere(s, key, "Steve", "Other", "Done before the dashboard");
        }
        Assert.Equal("active", s.Status);

        StepCatalog.Complete(s, StepKeys.Training, "Steve");

        Assert.Equal("completed", s.Status);
        Assert.Equal(StepCatalog.CompletedOnDashboard, s.Step(StepKeys.Training).CompletedHow);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("  ab ")]
    public void A_note_is_required(string? note)
        => Assert.NotNull(StepCatalog.ElsewhereProblem("Other", note));

    [Fact]
    public void A_note_has_a_limit_and_a_method_is_required()
    {
        Assert.NotNull(StepCatalog.ElsewhereProblem("Other", new string('x', 501)));
        Assert.Null(StepCatalog.ElsewhereProblem("Other", new string('x', 500)));
        Assert.NotNull(StepCatalog.ElsewhereProblem(" ", "Done in Settings"));
        Assert.Null(StepCatalog.ElsewhereProblem("Other", "abc"));
    }

    [Fact]
    public void Reopen_clears_how_and_puts_skipped_rows_back()
    {
        var s = Session();
        var clients = s.Step(StepKeys.Clients);
        clients.Rows.Add(new RowResult { Kind = "client", Key = "ACME", Status = RowStatus.NeedsData });
        StepCatalog.CompleteElsewhere(s, StepKeys.Clients, "Steve", "Other", "Loaded by hand");
        s.Status = "completed";

        StepCatalog.Reopen(s, StepKeys.Clients);

        Assert.Equal(StepStatus.InProgress, clients.Status);
        Assert.Null(clients.CompletedAt);
        Assert.Null(clients.CompletedBy);
        Assert.Equal(StepCatalog.CompletedOnDashboard, clients.CompletedHow);
        Assert.Null(clients.CompletedMethod);
        Assert.Null(clients.CompletedNote);
        Assert.Equal(RowStatus.Pending, clients.Rows.Single().Status);
        Assert.Equal("active", s.Status);
    }

    [Fact]
    public async Task A_skipped_row_is_never_sent_again()
    {
        var apps = new FakeApps();
        var s = Session();
        s.Step(StepKeys.Business).Checklist.Single(c => c.Id == StepCatalog.TenantIdentity).DoneAt = DateTime.UtcNow;
        s.Clients.Add(new ClientRow
        {
            Code = "ACME", Name = "Acme Freight", Address = "1 Market St", Suburb = "Kansas City", City = "MO",
            InvoiceScheduleId = 1, PaymentTermId = 2, InviteConfirmed = true,
            PrimaryContact = new ClientContactRow { FirstName = "Ann", Email = "ann@acme.test" }
        });
        s.Step(StepKeys.Clients).Rows.Add(new RowResult { Kind = "client", Key = "ACME", Status = RowStatus.Skipped });

        await new ClientsPusher(apps).PushAsync(s, Make.Caller(), CancellationToken.None);

        Assert.Empty(apps.Posts("/api/v1/tenant/clients"));
        Assert.Equal(RowStatus.Skipped, s.Step(StepKeys.Clients).Rows.Single().Status);
    }

    [Fact]
    public void Skipped_rows_survive_pruning_and_do_not_block()
    {
        var s = Session();
        var step = s.Step(StepKeys.Partners);
        step.Rows.Add(new RowResult { Kind = "partner", Key = "P1", Status = RowStatus.Skipped, UpdatedAt = DateTime.UtcNow.AddHours(-1) });

        RowLedger.PruneStale(step, DateTime.UtcNow);

        Assert.Single(step.Rows);
        Assert.Null(StepCatalog.CompleteBlocker(s, StepKeys.Partners));
    }

    [Fact]
    public void Sessions_saved_before_this_change_read_as_done_on_the_dashboard()
    {
        const string old = """{"key":"team","status":"done","completedBy":"Dane","requests":[],"rows":[],"checklist":[]}""";

        var step = JsonSerializer.Deserialize<StepState>(old, DistributedSessionStore.Json)!;

        Assert.Equal(StepCatalog.CompletedOnDashboard, step.CompletedHow);
        Assert.Null(step.CompletedNote);
    }

    [Fact]
    public void A_checklist_tick_keeps_a_note_and_unticking_clears_it()
    {
        var item = new ChecklistItem { Id = "depots", Owner = "DFRNT" };

        StepCatalog.Tick(item, true, "Steve", "  Three depots made in Admin Manager ");
        Assert.NotNull(item.DoneAt);
        Assert.Equal("Steve", item.DoneBy);
        Assert.Equal("Three depots made in Admin Manager", item.Note);

        StepCatalog.Tick(item, false, "Steve", "ignored");
        Assert.Null(item.DoneAt);
        Assert.Null(item.DoneBy);
        Assert.Null(item.Note);
    }

    [Fact]
    public void A_blank_checklist_note_is_stored_as_none()
    {
        var item = new ChecklistItem { Id = "logo" };

        StepCatalog.Tick(item, true, "Steve", "   ");

        Assert.Null(item.Note);
    }
}
