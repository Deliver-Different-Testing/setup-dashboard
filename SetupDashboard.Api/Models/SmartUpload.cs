namespace SetupDashboard.Models;

public class FieldMapping
{
    public string CsvColumn { get; set; } = "";
    public string DfField { get; set; } = "";
    public int Confidence { get; set; }
    public string? Transform { get; set; }
}

public class DetectionResult
{
    public bool Success { get; set; } = true;
    public string System { get; set; } = "CSV Upload";
    public int Confidence { get; set; }
    public string EntityType { get; set; } = "";
    public List<string> Headers { get; set; } = new();
    public int RowCount { get; set; }
    public List<FieldMapping> SuggestedMappings { get; set; } = new();
    public List<string> DfFields { get; set; } = new();
    public string? Message { get; set; }
}

public class PreviewRequest
{
    public string SessionId { get; set; } = "";
    public List<FieldMapping> Mappings { get; set; } = new();
    public string EntityType { get; set; } = "";
}

public class PreviewResult
{
    public bool Success { get; set; } = true;
    public List<Dictionary<string, object?>> Preview { get; set; } = new();
    public ValidationResult Validation { get; set; } = new();
    public string? Message { get; set; }
}

public class ValidationResult
{
    public List<string> Errors { get; set; } = new();
    public List<string> Warnings { get; set; } = new();
}

public class ImportRequest
{
    public string SessionId { get; set; } = "";
    public List<FieldMapping> Mappings { get; set; } = new();
    public string EntityType { get; set; } = "";
}

public class ImportResult
{
    public bool Success { get; set; }
    public int Imported { get; set; }
    public int Failed { get; set; }
    public int Total { get; set; }
    public List<string> Errors { get; set; } = new();
    public List<ImportItemResult> Results { get; set; } = new();
    /// <summary>
    /// All mapped rows returned from execute so the frontend can populate the full list
    /// (preview is capped at 20 rows; this contains all rows).
    /// </summary>
    public List<Dictionary<string, string?>> MappedData { get; set; } = new();
}

public class ImportItemResult
{
    public int Row { get; set; }
    public bool Success { get; set; }
    public string? Error { get; set; }
    public int? Id { get; set; }
}

public class EntityFieldDefinition
{
    public string FieldName { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public bool Required { get; set; }
    public string? Type { get; set; }
    public List<string> Aliases { get; set; } = new();
}

/// <summary>
/// Defines the target fields and CSV template for each importable entity type
/// </summary>
public static class EntityDefinitions
{
    // Target fields per step. "Required" mirrors what the owning app rejects without (Settings
    // TenantClientsService, AdminContactService, NpFleetService on develop 3a3fde0); an import can
    // still bring rows in without them - they show as "needs: ..." until filled in.
    public static readonly Dictionary<string, List<EntityFieldDefinition>> Fields = new()
    {
        ["team"] = new()
        {
            new() { FieldName = "FirstName", DisplayName = "First Name", Required = true, Aliases = ["GivenName", "First", "Name", "FullName"] },
            new() { FieldName = "LastName", DisplayName = "Last Name", Required = false, Aliases = ["Surname", "FamilyName", "Last"] },
            new() { FieldName = "Email", DisplayName = "Email", Required = true, Aliases = ["EmailAddress", "E-Mail", "Username"] },
            new() { FieldName = "JobTitle", DisplayName = "Job Title", Required = false, Aliases = ["Title", "Position"] },
            new() { FieldName = "Mobile", DisplayName = "Mobile", Required = false, Aliases = ["Phone", "Cell", "MobilePhone"] },
            new() { FieldName = "Role", DisplayName = "Role", Required = true, Aliases = ["AccessRole", "Department", "Group"] },
        },
        ["clients"] = new()
        {
            new() { FieldName = "Code", DisplayName = "Client Code", Required = true, Aliases = ["ClientCode", "AccountCode", "CustCode", "ID", "Account"] },
            new() { FieldName = "Name", DisplayName = "Client Name", Required = true, Aliases = ["ClientName", "Company", "CompanyName", "AccountName", "CustName"] },
            new() { FieldName = "Address", DisplayName = "Street Address", Required = true, Aliases = ["Address1", "AddressLine1", "Street", "StreetAddress", "DelAddr1"] },
            new() { FieldName = "Unit", DisplayName = "Unit / Suite", Required = false, Aliases = ["Address2", "AddressLine2", "Suite", "Floor"] },
            new() { FieldName = "Suburb", DisplayName = "Suburb (US: City)", Required = true, Aliases = ["Suburb", "Town", "Locality"] },
            new() { FieldName = "City", DisplayName = "City (US: State)", Required = true, Aliases = ["City", "State", "Region", "Province"] },
            new() { FieldName = "PostCode", DisplayName = "Post / Zip Code", Required = false, Aliases = ["PostalCode", "Zip", "ZipCode"] },
            new() { FieldName = "Country", DisplayName = "Country", Required = false, Aliases = ["CountryCode", "Nation"] },
            new() { FieldName = "Phone", DisplayName = "Phone", Required = false, Aliases = ["PhoneNumber", "Tel", "Telephone"] },
            new() { FieldName = "Email", DisplayName = "Company Email", Required = false, Aliases = ["EmailAddress", "CompanyEmail"] },
            new() { FieldName = "InvoiceEmail", DisplayName = "Invoice Email", Required = false, Aliases = ["AccountsEmail", "BillingEmail"] },
            new() { FieldName = "ContactFirstName", DisplayName = "Primary Contact First Name", Required = true, Aliases = ["ContactFirst", "Contact", "ContactName", "PrimaryContact"] },
            new() { FieldName = "ContactSurname", DisplayName = "Primary Contact Surname", Required = false, Aliases = ["ContactLast", "ContactSurname"] },
            new() { FieldName = "ContactEmail", DisplayName = "Primary Contact Email", Required = true, Aliases = ["ContactEmail", "PrimaryEmail"] },
            new() { FieldName = "ContactMobile", DisplayName = "Primary Contact Mobile", Required = false, Aliases = ["ContactPhone", "ContactMobile"] },
        },
        ["contacts"] = new()
        {
            new() { FieldName = "ClientCode", DisplayName = "Client Code", Required = true, Aliases = ["Code", "AccountCode", "ClientName", "Company", "Account"] },
            new() { FieldName = "FirstName", DisplayName = "First Name", Required = true, Aliases = ["GivenName", "First"] },
            new() { FieldName = "LastName", DisplayName = "Last Name", Required = false, Aliases = ["Surname", "FamilyName", "Last"] },
            new() { FieldName = "Email", DisplayName = "Email", Required = true, Aliases = ["EmailAddress", "E-Mail"] },
            new() { FieldName = "Phone", DisplayName = "Mobile", Required = false, Aliases = ["PhoneNumber", "Mobile", "Cell"] },
            new() { FieldName = "JobTitle", DisplayName = "Job Title", Required = false, Aliases = ["Title", "Position", "Role"] },
        },
        ["drivers"] = new()
        {
            new() { FieldName = "FirstName", DisplayName = "First Name", Required = true, Aliases = ["GivenName", "First", "Name", "DriverName"] },
            new() { FieldName = "SurName", DisplayName = "Last Name", Required = true, Aliases = ["LastName", "Surname", "FamilyName"] },
            new() { FieldName = "Email", DisplayName = "Email", Required = true, Aliases = ["EmailAddress", "E-Mail", "Login"] },
            new() { FieldName = "Code", DisplayName = "Courier Code", Required = false, Aliases = ["CourierCode", "DriverCode", "ID", "Fleet Number", "FleetNumber"] },
            new() { FieldName = "Phone", DisplayName = "Mobile", Required = false, Aliases = ["Mobile", "Cell", "PersonalMobile", "PhoneNumber"] },
            new() { FieldName = "Vehicle", DisplayName = "Vehicle Type", Required = false, Aliases = ["VehicleType", "Transport"] },
            new() { FieldName = "Fleet", DisplayName = "Vehicle Fleet", Required = false, Aliases = ["FleetName", "Depot", "Branch"] },
        },
        ["zones"] = new()
        {
            new() { FieldName = "ZoneGroup", DisplayName = "Zone Group", Required = true, Aliases = ["Group", "ZoneGroupName", "Region"] },
            new() { FieldName = "ZoneName", DisplayName = "Zone Name", Required = true, Aliases = ["Name", "Zone", "Area"] },
            new() { FieldName = "ZipCode", DisplayName = "Zip / Post Code", Required = true, Aliases = ["PostCode", "PostalCode", "Zip", "Code"] },
        },
        ["rates"] = new()
        {
            new() { FieldName = "Name", DisplayName = "Rate Name", Required = true, Aliases = ["RateName", "Description"] },
            new() { FieldName = "FromZone", DisplayName = "From Zone", Required = true, Aliases = ["From", "OriginZone", "Origin"] },
            new() { FieldName = "ToZone", DisplayName = "To Zone", Required = true, Aliases = ["To", "DestinationZone", "Destination"] },
            new() { FieldName = "ChargeRate", DisplayName = "Customer Charge ($)", Required = true, Aliases = ["Rate", "Price", "Amount", "Charge"] },
            new() { FieldName = "DriverRate", DisplayName = "Driver Rate ($)", Required = true, Aliases = ["DriverPay", "CourierRate", "Pay"] },
            new() { FieldName = "VehicleSize", DisplayName = "Vehicle Size", Required = true, Aliases = ["Vehicle", "VehicleType"] },
        },
    };

    // "agents" was an alias for drivers in the Admin Manager era.
    public static List<EntityFieldDefinition>? For(string entityType)
        => Fields.TryGetValue(entityType == "agents" ? "drivers" : entityType, out var f) ? f : null;

    public static List<string> GetFieldNames(string entityType)
        => Fields.TryGetValue(entityType, out var defs) ? defs.Select(d => d.FieldName).ToList() : new();

    public static List<string> GetTemplateHeaders(string entityType)
        => Fields.TryGetValue(entityType, out var defs) ? defs.Select(d => d.DisplayName).ToList() : new();
}
