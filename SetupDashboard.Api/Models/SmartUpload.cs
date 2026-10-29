namespace SetupDashboard.Models;

public class FieldMapping
{
    public string CsvColumn { get; set; } = string.Empty;
    public string DfField { get; set; } = string.Empty;
    public int Confidence { get; set; }
    public string? Transform { get; set; }
}

public class DetectionResult
{
    public bool Success { get; set; } = true;
    public string System { get; set; } = "CSV Upload";
    public int Confidence { get; set; }
    public string EntityType { get; set; } = string.Empty;
    public List<string> Headers { get; set; } = [];
    public int RowCount { get; set; }
    public List<FieldMapping> SuggestedMappings { get; set; } = [];
    public List<string> DfFields { get; set; } = [];
    public string? Message { get; set; }
}

public class PreviewRequest
{
    public string SessionId { get; set; } = string.Empty;
    public List<FieldMapping> Mappings { get; set; } = [];
    public string EntityType { get; set; } = string.Empty;
}

public class PreviewResult
{
    public bool Success { get; set; } = true;
    public List<Dictionary<string, object?>> Preview { get; set; } = [];
    public ValidationResult Validation { get; set; } = new();
    public string? Message { get; set; }
}

public class ValidationResult
{
    public List<string> Errors { get; set; } = [];
    public List<string> Warnings { get; set; } = [];
}

public class ImportRequest
{
    public string SessionId { get; set; } = string.Empty;
    public List<FieldMapping> Mappings { get; set; } = [];
    public string EntityType { get; set; } = string.Empty;
}

public class ImportResult
{
    public bool Success { get; set; }
    public int Imported { get; set; }
    public int Failed { get; set; }
    public int Total { get; set; }
    public List<string> Errors { get; set; } = [];
    public List<ImportItemResult> Results { get; set; } = [];
    /// <summary>
    /// All mapped rows returned from execute so the frontend can populate the full list
    /// (preview is capped at 20 rows; this contains all rows).
    /// </summary>
    public List<Dictionary<string, string?>> MappedData { get; set; } = [];
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
    public string FieldName { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public bool Required { get; set; }
    public string? Type { get; set; }
    public List<string> Aliases { get; set; } = [];
}

/// <summary>
/// Defines the target fields and CSV template for each importable entity type
/// </summary>
public static class EntityDefinitions
{
    // Target fields per step. "Required" mirrors what the owning app rejects without (Settings
    // TenantClientsService, AdminContactService, NpFleetService on develop 3a3fde0); an import can
    // still bring rows in without them - they show as "needs: ..." until filled in.
    private static readonly Dictionary<string, List<EntityFieldDefinition>> Fields = new()
    {
        ["team"] =
        [
            new EntityFieldDefinition
            {
                FieldName = "FirstName", DisplayName = "First Name", Required = true,
                Aliases = ["GivenName", "First", "Name", "FullName"]
            },
            new EntityFieldDefinition
            {
                FieldName = "LastName", DisplayName = "Last Name", Required = false,
                Aliases = ["Surname", "FamilyName", "Last"]
            },
            new EntityFieldDefinition
            {
                FieldName = "Email", DisplayName = "Email", Required = true,
                Aliases = ["EmailAddress", "E-Mail", "Username"]
            },
            new EntityFieldDefinition
            {
                FieldName = "JobTitle", DisplayName = "Job Title", Required = false, Aliases = ["Title", "Position"]
            },
            new EntityFieldDefinition
            {
                FieldName = "Mobile", DisplayName = "Mobile", Required = false,
                Aliases = ["Phone", "Cell", "MobilePhone"]
            },
            new EntityFieldDefinition
            {
                FieldName = "Role", DisplayName = "Role", Required = true,
                Aliases = ["AccessRole", "Department", "Group"]
            }
        ],
        ["clients"] =
        [
            new EntityFieldDefinition
            {
                FieldName = "Code", DisplayName = "Client Code", Required = true,
                Aliases = ["ClientCode", "AccountCode", "CustCode", "ID", "Account"]
            },
            new EntityFieldDefinition
            {
                FieldName = "Name", DisplayName = "Client Name", Required = true,
                Aliases = ["ClientName", "Company", "CompanyName", "AccountName", "CustName"]
            },
            new EntityFieldDefinition
            {
                FieldName = "Address", DisplayName = "Street Address", Required = true,
                Aliases = ["Address1", "AddressLine1", "Street", "StreetAddress", "DelAddr1"]
            },
            new EntityFieldDefinition
            {
                FieldName = "Unit", DisplayName = "Unit / Suite", Required = false,
                Aliases = ["Address2", "AddressLine2", "Suite", "Floor"]
            },
            new EntityFieldDefinition
            {
                FieldName = "Suburb", DisplayName = "Suburb (US: City)", Required = true,
                Aliases = ["Suburb", "Town", "Locality"]
            },
            new EntityFieldDefinition
            {
                FieldName = "City", DisplayName = "City (US: State)", Required = true,
                Aliases = ["City", "State", "Region", "Province"]
            },
            new EntityFieldDefinition
            {
                FieldName = "PostCode", DisplayName = "Post / Zip Code", Required = false,
                Aliases = ["PostalCode", "Zip", "ZipCode"]
            },
            new EntityFieldDefinition
            {
                FieldName = "Country", DisplayName = "Country", Required = false, Aliases = ["CountryCode", "Nation"]
            },
            new EntityFieldDefinition
            {
                FieldName = "Phone", DisplayName = "Phone", Required = false,
                Aliases = ["PhoneNumber", "Tel", "Telephone"]
            },
            new EntityFieldDefinition
            {
                FieldName = "Email", DisplayName = "Company Email", Required = false,
                Aliases = ["EmailAddress", "CompanyEmail"]
            },
            new EntityFieldDefinition
            {
                FieldName = "InvoiceEmail", DisplayName = "Invoice Email", Required = false,
                Aliases = ["AccountsEmail", "BillingEmail"]
            },
            new EntityFieldDefinition
            {
                FieldName = "ContactFirstName", DisplayName = "Primary Contact First Name", Required = true,
                Aliases = ["ContactFirst", "Contact", "ContactName", "PrimaryContact"]
            },
            new EntityFieldDefinition
            {
                FieldName = "ContactSurname", DisplayName = "Primary Contact Surname", Required = false,
                Aliases = ["ContactLast", "ContactSurname"]
            },
            new EntityFieldDefinition
            {
                FieldName = "ContactEmail", DisplayName = "Primary Contact Email", Required = true,
                Aliases = ["ContactEmail", "PrimaryEmail"]
            },
            new EntityFieldDefinition
            {
                FieldName = "ContactMobile", DisplayName = "Primary Contact Mobile", Required = false,
                Aliases = ["ContactPhone", "ContactMobile"]
            }
        ],
        ["contacts"] =
        [
            new EntityFieldDefinition
            {
                FieldName = "ClientCode", DisplayName = "Client Code", Required = true,
                Aliases = ["Code", "AccountCode", "ClientName", "Company", "Account"]
            },
            new EntityFieldDefinition
            {
                FieldName = "FirstName", DisplayName = "First Name", Required = true, Aliases = ["GivenName", "First"]
            },
            new EntityFieldDefinition
            {
                FieldName = "LastName", DisplayName = "Last Name", Required = false,
                Aliases = ["Surname", "FamilyName", "Last"]
            },
            new EntityFieldDefinition { FieldName = "Email", DisplayName = "Email", Required = true, Aliases = ["EmailAddress", "E-Mail"] },
            new EntityFieldDefinition
            {
                FieldName = "Phone", DisplayName = "Mobile", Required = false,
                Aliases = ["PhoneNumber", "Mobile", "Cell"]
            },
            new EntityFieldDefinition
            {
                FieldName = "JobTitle", DisplayName = "Job Title", Required = false,
                Aliases = ["Title", "Position", "Role"]
            }
        ],
        ["drivers"] =
        [
            new EntityFieldDefinition
            {
                FieldName = "FirstName", DisplayName = "First Name", Required = true,
                Aliases = ["GivenName", "First", "Name", "DriverName"]
            },
            new EntityFieldDefinition
            {
                FieldName = "SurName", DisplayName = "Last Name", Required = true,
                Aliases = ["LastName", "Surname", "FamilyName"]
            },
            new EntityFieldDefinition
            {
                FieldName = "Email", DisplayName = "Email", Required = true,
                Aliases = ["EmailAddress", "E-Mail", "Login"]
            },
            new EntityFieldDefinition
            {
                FieldName = "Code", DisplayName = "Courier Code", Required = false,
                Aliases = ["CourierCode", "DriverCode", "ID", "Fleet Number", "FleetNumber"]
            },
            new EntityFieldDefinition
            {
                FieldName = "Phone", DisplayName = "Mobile", Required = false,
                Aliases = ["Mobile", "Cell", "PersonalMobile", "PhoneNumber"]
            },
            new EntityFieldDefinition
            {
                FieldName = "Vehicle", DisplayName = "Vehicle Type", Required = false,
                Aliases = ["VehicleType", "Transport"]
            },
            new EntityFieldDefinition
            {
                FieldName = "Fleet", DisplayName = "Vehicle Fleet", Required = false,
                Aliases = ["FleetName", "Depot", "Branch"]
            }
        ],
        ["zones"] =
        [
            new EntityFieldDefinition
            {
                FieldName = "ZoneGroup", DisplayName = "Zone Group", Required = true,
                Aliases = ["Group", "ZoneGroupName", "Region"]
            },
            new EntityFieldDefinition
            {
                FieldName = "ZoneName", DisplayName = "Zone Name", Required = true, Aliases = ["Name", "Zone", "Area"]
            },
            new EntityFieldDefinition
            {
                FieldName = "ZipCode", DisplayName = "Zip / Post Code", Required = true,
                Aliases = ["PostCode", "PostalCode", "Zip", "Code"]
            }
        ],
        ["rates"] =
        [
            new EntityFieldDefinition
            {
                FieldName = "Name", DisplayName = "Rate Name", Required = true, Aliases = ["RateName", "Description"]
            },
            new EntityFieldDefinition
            {
                FieldName = "FromZone", DisplayName = "From Zone", Required = true,
                Aliases = ["From", "OriginZone", "Origin"]
            },
            new EntityFieldDefinition
            {
                FieldName = "ToZone", DisplayName = "To Zone", Required = true,
                Aliases = ["To", "DestinationZone", "Destination"]
            },
            new EntityFieldDefinition
            {
                FieldName = "ChargeRate", DisplayName = "Customer Charge ($)", Required = true,
                Aliases = ["Rate", "Price", "Amount", "Charge"]
            },
            new EntityFieldDefinition
            {
                FieldName = "DriverRate", DisplayName = "Driver Rate ($)", Required = true,
                Aliases = ["DriverPay", "CourierRate", "Pay"]
            },
            new EntityFieldDefinition
            {
                FieldName = "VehicleSize", DisplayName = "Vehicle Size", Required = true,
                Aliases = ["Vehicle", "VehicleType"]
            }
        ]
    };

    // "agents" was an alias for drivers in the Admin Manager era.
    public static List<EntityFieldDefinition>? For(string entityType)
        => Fields.TryGetValue(entityType == "agents" ? "drivers" : entityType, out var f) ? f : null;

    public static List<string> GetTemplateHeaders(string entityType)
        => Fields.TryGetValue(entityType, out var defs) ? [.. defs.Select(d => d.DisplayName)] : [];
}
