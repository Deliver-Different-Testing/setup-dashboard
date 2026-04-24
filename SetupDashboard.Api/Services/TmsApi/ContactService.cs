using SetupDashboard.Models.TmsApi;

namespace SetupDashboard.Services.TmsApi;

/// <summary>
/// Contact and Client-Contact Management — 10+ tools from contacts.ts.
/// 
/// QUIRKS:
///   - Contact endpoints use /API/contact (capital API), not /api/contact
///   - GET /API/clientContact/{id} interprets ID as contactId (returns list), not link ID
///   - Client-contact update: POST directly without fetching (GET returns contact's list, not link)
/// </summary>
public class ContactService : TmsServiceBase
{
    public ContactService(AdminManagerClient client) : base(client) { }

    // --- Contacts ---

    public async Task<List<Contact>> SearchContactsAsync(string searchText = " ")
    {
        var json = await Client.PostRawAsync("/API/contact/search", new { searchText });
        return ExtractArray<Contact>(json, "contacts");
    }

    public async Task<string> GetContactAsync(int contactId)
        => await GetRawAsync($"/API/contact/{contactId}");

    public async Task<string> CreateContactAsync(Dictionary<string, object?> fields)
    {
        // Defaults
        if (!fields.ContainsKey("groupEmail") && fields.ContainsKey("email"))
            fields["groupEmail"] = fields["email"];
        if (!fields.ContainsKey("validatedEmail")) fields["validatedEmail"] = true;
        if (!fields.ContainsKey("active")) fields["active"] = true;
        return await Client.PostRawAsync("/API/contact", fields);
    }

    public async Task<string> UpdateContactAsync(int contactId, Dictionary<string, object?> updates)
        => await UpdateEntityAsync("/API/contact", contactId, "contact", updates, "lastAccessed", "client");

    public async Task DeleteContactAsync(int contactId)
        => await Client.DeleteAsync($"/API/contact/{contactId}");

    // --- Client-Contact Links ---

    /// <summary>Get all client associations for a contact (many-to-many).</summary>
    public async Task<List<ClientContact>> ListClientContactsAsync(int contactId)
    {
        var json = await GetRawAsync($"/API/clientContact/{contactId}");
        return ExtractArray<ClientContact>(json, "clientContacts");
    }

    public async Task<string> CreateClientContactAsync(int contactId, int clientId, bool isDefault = false)
        => await Client.PostRawAsync("/API/clientContact", new { contactId, clientId, @default = isDefault });

    /// <summary>
    /// Update client-contact. POST directly since GET interprets ID as contactId.
    /// </summary>
    public async Task<string> UpdateClientContactAsync(int clientContactId, Dictionary<string, object?> fields)
    {
        fields["id"] = clientContactId;
        return await Client.PostRawAsync($"/API/clientContact/{clientContactId}", fields);
    }

    public async Task DeleteClientContactAsync(int clientContactId)
        => await Client.DeleteAsync($"/API/clientContact/{clientContactId}");

    // --- Permissions ---

    public async Task<string> ListInternetPermissionsAsync()
        => await GetRawAsync("/API/internetPermission");

    public async Task<string> GetContactPermissionsAsync(int clientContactId)
        => await GetRawAsync($"/API/internetPermission?clientContactId={clientContactId}");

    // --- Communication Types ---

    public async Task<string> SearchCommunicationTypesAsync(string searchText = "")
    {
        return await Client.PostRawAsync("/API/CommunicationType/Search", new { searchText });
    }
}
