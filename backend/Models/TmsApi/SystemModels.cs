namespace SetupDashboard.Models.TmsApi;

public class Suburb
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string? PostCode { get; set; }
    public string? Area { get; set; }
}

public class AccountStatus
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public bool? EmailRequired { get; set; }
}

public class JobStatus
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string? Code { get; set; }
}

public class EventType
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string? Group { get; set; }
}

public class ServiceTracking
{
    public int Id { get; set; }
    public string? Description { get; set; }
}

public class TmsUser
{
    public int Id { get; set; }
    public string? UserName { get; set; }
    public string? FullName { get; set; }
    public bool Active { get; set; }
}

public class ClearListArea
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
}

public class Category
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
}

public class Site
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
}
