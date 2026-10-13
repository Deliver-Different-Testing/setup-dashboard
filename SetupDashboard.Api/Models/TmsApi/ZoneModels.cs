namespace SetupDashboard.Models.TmsApi;

public class ZoneName
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    public int? LocationId { get; set; }
    public int? ZoneGroupId { get; set; }
}

public class ZoneZip
{
    public int Id { get; set; }
    public string Zip { get; set; } = "";
    public int ZoneNumber { get; set; }
    public int ZoneNameId { get; set; }
    public string? Location { get; set; }
}

public class CreateZoneZipRequest
{
    public string Zip { get; set; } = "";
    public int ZoneNumber { get; set; }
    public int ZoneNameId { get; set; }
    public string? Location { get; set; }
}

public class ZoneGroup
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
}

public class BulkRegion
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
}
