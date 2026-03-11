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
    public static readonly Dictionary<string, List<EntityFieldDefinition>> Fields = new()
    {
        ["team"] = new()
        {
            new() { FieldName = "Name", DisplayName = "Full Name", Required = true, Aliases = ["FullName", "StaffName", "MemberName"] },
            new() { FieldName = "Email", DisplayName = "Email", Required = true, Aliases = ["EmailAddress", "E-Mail", "Username"] },
            new() { FieldName = "Role", DisplayName = "Role", Required = false, Aliases = ["JobTitle", "Position", "Title", "Department"] },
        },
        ["clients"] = new()
        {
            new() { FieldName = "Name", DisplayName = "Client Name", Required = true, Aliases = ["ClientName", "Company", "CompanyName", "Account", "AccountName"] },
            new() { FieldName = "Code", DisplayName = "Client Code", Required = false, Aliases = ["ClientCode", "AccountCode", "ID"] },
            new() { FieldName = "Contact", DisplayName = "Contact Person", Required = false, Aliases = ["ContactName", "ContactPerson", "PrimaryContact"] },
            new() { FieldName = "Phone", DisplayName = "Phone", Required = false, Aliases = ["PhoneNumber", "Tel", "Telephone", "ContactPhone"] },
            new() { FieldName = "Email", DisplayName = "Email", Required = false, Aliases = ["EmailAddress", "ContactEmail", "E-Mail"] },
            new() { FieldName = "Billing", DisplayName = "Billing Type", Required = false, Aliases = ["BillingType", "PaymentTerms", "InvoiceType"] },
            new() { FieldName = "LegalName", DisplayName = "Legal Name", Required = false, Aliases = ["LegalBusinessName", "RegisteredName"] },
            new() { FieldName = "Type", DisplayName = "Client Type", Required = false, Aliases = ["ClientType", "AccountType", "Category"] },
            new() { FieldName = "City", DisplayName = "City", Required = false, Aliases = ["Suburb", "Town"] },
            new() { FieldName = "State", DisplayName = "State", Required = false, Aliases = ["Region", "Province"] },
            new() { FieldName = "ZipCode", DisplayName = "Zip Code", Required = false, Aliases = ["PostCode", "PostalCode", "Zip"] },
        },
        ["contacts"] = new()
        {
            new() { FieldName = "ClientName", DisplayName = "Client Name", Required = true, Aliases = ["Company", "Account"] },
            new() { FieldName = "FirstName", DisplayName = "First Name", Required = true, Aliases = ["GivenName", "First"] },
            new() { FieldName = "LastName", DisplayName = "Last Name", Required = true, Aliases = ["Surname", "FamilyName", "Last"] },
            new() { FieldName = "Email", DisplayName = "Email", Required = false, Aliases = ["EmailAddress", "E-Mail"] },
            new() { FieldName = "Phone", DisplayName = "Phone", Required = false, Aliases = ["PhoneNumber", "Mobile", "Cell"] },
            new() { FieldName = "Role", DisplayName = "Role", Required = false, Aliases = ["JobTitle", "Title", "Position"] },
            new() { FieldName = "IsPrimary", DisplayName = "Primary Contact", Required = false, Aliases = ["Primary", "Main", "Default"] },
        },
        ["drivers"] = new()
        {
            new() { FieldName = "Name", DisplayName = "Full Name", Required = true, Aliases = ["DriverName", "FullName", "CourierName"] },
            new() { FieldName = "Code", DisplayName = "Courier Code", Required = false, Aliases = ["CourierCode", "DriverCode", "ID"] },
            new() { FieldName = "FirstName", DisplayName = "First Name", Required = false, Aliases = ["GivenName", "First"] },
            new() { FieldName = "SurName", DisplayName = "Last Name", Required = false, Aliases = ["LastName", "Surname", "FamilyName"] },
            new() { FieldName = "Phone", DisplayName = "Phone", Required = false, Aliases = ["Mobile", "Cell", "PersonalMobile", "PhoneNumber"] },
            new() { FieldName = "Vehicle", DisplayName = "Vehicle Type", Required = false, Aliases = ["VehicleType", "Transport", "CourierType"] },
            new() { FieldName = "Zone", DisplayName = "Zone", Required = false, Aliases = ["Area", "Region", "Territory"] },
        },
        ["zones"] = new()
        {
            new() { FieldName = "ZoneName", DisplayName = "Zone Name", Required = true, Aliases = ["Name", "Zone", "Area"] },
            new() { FieldName = "ZipCode", DisplayName = "Zip Code", Required = true, Aliases = ["PostCode", "PostalCode", "Zip", "Code"] },
            new() { FieldName = "ZoneNumber", DisplayName = "Zone Number", Required = false, Aliases = ["Number", "ZoneNum", "Num"] },
            new() { FieldName = "Location", DisplayName = "Location", Required = false, Aliases = ["Suburb", "City", "Area", "Description"] },
        },
        ["rates"] = new()
        {
            new() { FieldName = "ZoneName", DisplayName = "Zone Name", Required = true, Aliases = ["Zone", "Area"] },
            new() { FieldName = "ServiceType", DisplayName = "Service Type", Required = true, Aliases = ["Service", "Speed", "DeliveryType"] },
            new() { FieldName = "MinWeight", DisplayName = "Min Weight (kg)", Required = true, Aliases = ["WeightFrom", "FromWeight", "Min"] },
            new() { FieldName = "MaxWeight", DisplayName = "Max Weight (kg)", Required = true, Aliases = ["WeightTo", "ToWeight", "Max"] },
            new() { FieldName = "Rate", DisplayName = "Rate ($)", Required = true, Aliases = ["Price", "Amount", "Cost", "Charge"] },
            new() { FieldName = "OriginZone", DisplayName = "Origin Zone", Required = false, Aliases = ["From", "FromZone", "Origin"] },
            new() { FieldName = "DestinationZone", DisplayName = "Destination Zone", Required = false, Aliases = ["To", "ToZone", "Destination"] },
        },
    };

    public static List<string> GetFieldNames(string entityType)
        => Fields.TryGetValue(entityType, out var defs) ? defs.Select(d => d.FieldName).ToList() : new();

    public static List<string> GetTemplateHeaders(string entityType)
        => Fields.TryGetValue(entityType, out var defs) ? defs.Select(d => d.DisplayName).ToList() : new();
}
