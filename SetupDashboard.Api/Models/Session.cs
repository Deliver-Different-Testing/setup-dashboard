namespace SetupDashboard.Models;

public class SetupSession
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N")[..12];
    public string Environment { get; set; } = "medical-staging";
    public int CurrentStep { get; set; }
    public List<int> CompletedSteps { get; set; } = new();
    public BusinessProfile? Business { get; set; }
    public List<TeamMember> Team { get; set; } = new();
    public List<ClientRecord> Clients { get; set; } = new();
    public RateConfig? Rates { get; set; }
    public List<CourierRecord> Couriers { get; set; } = new();
    public List<SetupAutomationRule> Automations { get; set; } = new();
    public List<TrainingMember> TrainingProgress { get; set; } = new();
    public Dictionary<string, List<int>> ProvisionedIds { get; set; } = new();
    public string Status { get; set; } = "active";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class BusinessProfile
{
    public string? CompanyName { get; set; }
    public List<string> Geography { get; set; } = new();
    public List<string> Verticals { get; set; } = new();
    public string? CurrentSystem { get; set; }
    public string? DeliveriesPerMonth { get; set; }
    public string? LegalName { get; set; }
    public string? RegistrationNumber { get; set; }
    public string? CountryOfRegistration { get; set; }
    public string? StateOfIncorporation { get; set; }
    public string? BusinessType { get; set; }
    public string? CardNumber { get; set; }
    public string? CardExpiry { get; set; }
    public string? CardCvc { get; set; }
    public string? CardholderName { get; set; }
    public Address? BillingAddress { get; set; }
    public ContactInfo? PrimaryContact { get; set; }
}

public class Address
{
    public string? Street { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
    public string? Zip { get; set; }
}

public class ContactInfo
{
    public string? Name { get; set; }
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? Title { get; set; }
}

public class TeamMember
{
    public string Name { get; set; } = "";
    public string Email { get; set; } = "";
    public string Role { get; set; } = "Admin";
}

public class ClientRecord
{
    public string Name { get; set; } = "";
    public string? Contact { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? Billing { get; set; }
    public string? Code { get; set; }
    public string? LegalName { get; set; }
    public string? Type { get; set; }
    public string? Address { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
    public string? ZipCode { get; set; }
}

public class RateConfig
{
    public decimal BaseRate { get; set; }
    public decimal PerKmRate { get; set; }
    public decimal MinCharge { get; set; }
    public decimal FuelSurcharge { get; set; }
    public decimal WaitTime { get; set; }
    public decimal AfterHours { get; set; }
    public List<ZoneRateRow> Zones { get; set; } = new();
    public List<WeightBreakRow> WeightBreaks { get; set; } = new();
}

public class ZoneRateRow
{
    [System.Text.Json.Serialization.JsonPropertyName("name")]
    public string Name { get; set; } = "";

    /// <summary>Accepts "zoneName" from the frontend as an alias for Name.</summary>
    [System.Text.Json.Serialization.JsonPropertyName("zoneName")]
    public string? ZoneName { get => null; set { if (!string.IsNullOrEmpty(value)) Name = value; } }

    public List<string> Ranges { get; set; } = new();

    // Band properties from frontend — stored as Ranges for display, also kept as typed values
    [System.Text.Json.Serialization.JsonPropertyName("band0to5")]
    public decimal? Band0to5 { get; set; }

    [System.Text.Json.Serialization.JsonPropertyName("band5to15")]
    public decimal? Band5to15 { get; set; }

    [System.Text.Json.Serialization.JsonPropertyName("band15to30")]
    public decimal? Band15to30 { get; set; }

    [System.Text.Json.Serialization.JsonPropertyName("band30Plus")]
    public decimal? Band30Plus { get; set; }
}

public class WeightBreakRow
{
    [System.Text.Json.Serialization.JsonPropertyName("min")]
    public decimal Min { get; set; }

    [System.Text.Json.Serialization.JsonPropertyName("max")]
    public decimal Max { get; set; }

    /// <summary>Accepts "minWeight" from the frontend as an alias for Min.</summary>
    [System.Text.Json.Serialization.JsonPropertyName("minWeight")]
    public decimal? MinWeight { get => null; set { if (value.HasValue) Min = value.Value; } }

    /// <summary>Accepts "maxWeight" from the frontend as an alias for Max.</summary>
    [System.Text.Json.Serialization.JsonPropertyName("maxWeight")]
    public decimal? MaxWeight { get => null; set { if (value.HasValue) Max = value.Value; } }

    public decimal Surcharge { get; set; }
}

public class CourierRecord
{
    public string Name { get; set; } = "";
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? Vehicle { get; set; }
    public string? Zone { get; set; }
    public string? Code { get; set; }
    public string? FirstName { get; set; }
    public string? SurName { get; set; }
    public string? Password { get; set; }
}

public class SetupAutomationRule
{
    public string Type { get; set; } = "";
    public bool Enabled { get; set; }
    public string? Name { get; set; }
    public string? Description { get; set; }
    public List<object>? Conditions { get; set; }
    public List<object>? Actions { get; set; }
}

public class TenantSummary
{
    public Dictionary<string, string> Settings { get; set; } = new();
    public TenantCounts Counts { get; set; } = new();
}

public class TenantCounts
{
    public int Team { get; set; }
    public int Clients { get; set; }
    public int Contacts { get; set; }
    public int Couriers { get; set; }
    public int Zones { get; set; }
    public int Automations { get; set; }
    public int Services { get; set; }
}

public class PaginatedResult<T>
{
    public List<T> Items { get; set; } = new();
    public int TotalCount { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
}

public class TrainingMember
{
    public string UserEmail { get; set; } = "";
    public string? UserName { get; set; }
    public string? Role { get; set; }
    public int Xp { get; set; }
    public List<string> CompletedChallenges { get; set; } = new();
    public int CurrentStreak { get; set; }
    public string? LastActive { get; set; }
}
