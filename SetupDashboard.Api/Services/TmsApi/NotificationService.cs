namespace SetupDashboard.Services.TmsApi;

/// <summary>
/// Notification Management — 4 tools from notifications.ts.
/// Uses /API/JobStatusNotification and /API/NotificationGroup (capital API).
/// </summary>
public class NotificationService : TmsServiceBase
{
    public NotificationService(AdminManagerClient client) : base(client) { }

    public async Task<string> SearchJobStatusNotificationsAsync(string searchText = "")
        => await Client.PostRawAsync("/API/JobStatusNotification/Search", new { searchText });

    public async Task<string> GetNotificationGroupAsync(int groupId)
        => await GetRawAsync($"/API/NotificationGroup/{groupId}");

    public async Task<string> AddNotificationToGroupAsync(int groupId, int notificationId)
        => await Client.PostRawAsync($"/API/NotificationGroup/{groupId}/notification", new { notificationId });

    public async Task RemoveNotificationFromGroupAsync(int groupId, int notificationId)
        => await Client.DeleteAsync($"/API/NotificationGroup/{groupId}/notification/{notificationId}");
}
