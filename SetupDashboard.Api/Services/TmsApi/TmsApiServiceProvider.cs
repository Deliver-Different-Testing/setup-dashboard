using SetupDashboard.Services;

namespace SetupDashboard.Services.TmsApi;

/// <summary>
/// Factory that creates all TMS API service instances from an AdminManagerClient.
/// Usage: get a client from AdminManagerClientFactory, then create a provider.
/// </summary>
public class TmsApiServiceProvider
{
    public ZoneService Zones { get; }
    public RateService Rates { get; }
    public AgentService Agents { get; }
    public ClientService Clients { get; }
    public ContactService Contacts { get; }
    public ServiceConfigService Services { get; }
    public HolidayService Holidays { get; }
    public ExtraChargeService ExtraCharges { get; }
    public FuelService Fuel { get; }
    public JobService Jobs { get; }
    public AutomationRuleService AutomationRules { get; }
    public SystemService System { get; }
    public LocationService Locations { get; }
    public NotificationService Notifications { get; }

    public TmsApiServiceProvider(AdminManagerClient client)
    {
        Zones = new ZoneService(client);
        Rates = new RateService(client);
        Agents = new AgentService(client);
        Clients = new ClientService(client);
        Contacts = new ContactService(client);
        Services = new ServiceConfigService(client);
        Holidays = new HolidayService(client);
        ExtraCharges = new ExtraChargeService(client);
        Fuel = new FuelService(client);
        Jobs = new JobService(client);
        AutomationRules = new AutomationRuleService(client);
        System = new SystemService(client);
        Locations = new LocationService(client);
        Notifications = new NotificationService(client);
    }
}
