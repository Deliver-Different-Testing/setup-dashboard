# Setup Dashboard — Competitor Migration Mapping

## Overview

When a tenant migrates from a competitor TMS to Deliver Different, they export their data (CSV/Excel) from their old system. The setup dashboard's import step maps competitor columns to the DF data model and creates entities via the MCP server / TMS API.

**Legal safeguard**: The tenant exports their own data. We never access competitor systems. The import tool maps and transforms — nothing more.

---

## DF Target Data Model (from MCP server)

### Clients
| DF Field | Type | Required | Notes |
|----------|------|----------|-------|
| name | string | ✅ | Company name |
| code | string | | Client code |
| legalName | string | | Legal business name |
| phone | string | | Phone number |
| email | string | | Email address |
| active | boolean | | Default: true |
| groupId | number | | Client group ID |
| type | string | | Client type |
| smsName | string | | SMS display name |
| americanCity | string | | City |
| americanState | string | | State abbreviation |
| americanZipCode | string | | Zip code |
| addressStreetName | string | | Street address |
| displayAddress | string | | Full display address |
| referralSource | number | | Referral source ID |

### Contacts (linked to clients)
| DF Field | Type | Required | Notes |
|----------|------|----------|-------|
| firstName | string | ✅ | |
| lastName | string | ✅ | |
| email | string | | |
| phone | string | | |
| mobile | string | | |
| clientId | number | ✅ | Link to client |

### Couriers/Drivers
| DF Field | Type | Required | Notes |
|----------|------|----------|-------|
| name | string | ✅ | Display name |
| code | string | | Courier code |
| firstName | string | | |
| surName | string | | |
| personalMobile | string | | |
| urgentMobile | string | | Work mobile |
| courierType | number | | 1=standard |
| active | boolean | | Default: true |
| internal | boolean | | Internal vs contractor |
| vehicleRegoNo | string | | Vehicle registration |
| email | string | ✅ | For courier login |
| password | string | ✅ | For courier login |

### Zones
| DF Field | Type | Required | Notes |
|----------|------|----------|-------|
| name | string | ✅ | Zone name |
| zips[].zip | string | ✅ | Zip code |
| zips[].zoneNumber | number | ✅ | Zone number within zone name |
| zips[].location | string | | Location description |

### Rate Cards
| DF Field | Type | Required | Notes |
|----------|------|----------|-------|
| name | string | ✅ | Rate card name |
| clientId | number | | Per-client rate card |
| speedId | number | | Service type |
| vehicleId | number | | Vehicle size |
| active | boolean | | Default: true |

### Rates (Distance-based)
| DF Field | Type | Required | Notes |
|----------|------|----------|-------|
| name | string | ✅ | Rate name |
| rateCardId | number | ✅ | Parent rate card |
| clientId | number | ✅ | Client |
| speedId | number | ✅ | Service type |
| vehicle | string | ✅ | Vehicle type name |
| startDistance | number | ✅ | Start distance (miles) |
| endDistance | number | ✅ | End distance (miles) |
| weightBreakGroupId | number | ✅ | Weight break group |
| baseCharge | number | | Base charge |
| perDistanceUnit | number | | Per-mile rate |
| distanceIncluded | number | | Miles included |

### Weight Breaks
| DF Field | Type | Required | Notes |
|----------|------|----------|-------|
| breakGroupId | number | ✅ | Parent break group |
| minWeight | number | ✅ | Min weight |
| maxWeight | number | ✅ | Max weight |
| rate | number | ✅ | Rate amount |

### Services/Speeds
| DF Field | Type | Notes |
|----------|------|-------|
| name | string | Service name (e.g. "Standard", "Express", "Same Day") |
| groupingId | number | Default: 1 (Excelerator) |

---

## Competitor Systems — Column Mapping

### 1. CXT Software (Xcelerator)

**Export method**: Reports → Export to CSV/Excel from Operations App
**Known modules**: Dispatch, Client Portal, MobileTek (driver app), Settlements

**Expected CSV columns → DF mapping:**

#### Clients Export
| CXT Column | DF Field | Transform |
|-----------|----------|-----------|
| AccountName / CustomerName | name | Direct |
| AccountCode / CustomerCode | code | Direct |
| LegalName / CompanyName | legalName | Direct |
| Phone / MainPhone | phone | Direct |
| Email / BillingEmail | email | Direct |
| Active / Status | active | "Active"→true, "Inactive"→false |
| City | americanCity | Direct |
| State | americanState | Normalize to 2-letter |
| ZipCode / Zip | americanZipCode | Direct |
| Address / StreetAddress | addressStreetName | Direct |
| BillingType | type | Map to DF types |

#### Drivers Export
| CXT Column | DF Field | Transform |
|-----------|----------|-----------|
| DriverName / Name | name | Direct |
| DriverCode / Code | code | Direct |
| FirstName | firstName | Direct |
| LastName | surName | Direct |
| CellPhone / Mobile | personalMobile | Direct |
| CompanyPhone | urgentMobile | Direct |
| VehicleType | courierType | Map to DF type IDs |
| Active / Status | active | "Active"→true |
| EmployeeType | internal | "Employee"→true, "Contractor"→false |
| VehicleNumber / LicensePlate | vehicleRegoNo | Direct |
| Email / LoginEmail | email | Direct |

#### Zones Export
| CXT Column | DF Field | Transform |
|-----------|----------|-----------|
| ZoneName / Zone | name | Direct |
| ZipCode / Zip | zips[].zip | Direct |
| ZoneNumber / Sector | zips[].zoneNumber | Direct |
| City / Area | zips[].location | Direct |

#### Rates Export
| CXT Column | DF Field | Transform |
|-----------|----------|-----------|
| RateName / RateSheet | name | Direct |
| CustomerCode | clientId | Lookup by code |
| ServiceLevel / ServiceType | speedId | Map to DF speeds |
| VehicleType / VehicleClass | vehicle | Map to DF vehicle names |
| MinMiles / StartMiles | startDistance | Direct |
| MaxMiles / EndMiles | endDistance | Direct |
| BaseRate / FlatRate | baseCharge | Direct |
| PerMileRate | perDistanceUnit | Direct |
| IncludedMiles | distanceIncluded | Direct |
| MinWeight | minWeight | Direct |
| MaxWeight | maxWeight | Direct |
| WeightRate | rate | Direct |

---

### 2. Key Software (Xcelerator / MobileTek)

**Export method**: Reports module → CSV export, or SQL Server backup
**Known modules**: Xcelerator (dispatch), MobileTek (driver app), settlements, AR

**Expected CSV columns → DF mapping:**

#### Clients/Accounts
| Key Column | DF Field | Transform |
|-----------|----------|-----------|
| Account_Name | name | Direct |
| Account_Number / Acct_No | code | Direct |
| Legal_Name | legalName | Direct |
| Phone_Number / Phone1 | phone | Direct |
| Email_Address | email | Direct |
| Status | active | "A"→true, "I"→false |
| City | americanCity | Direct |
| State | americanState | Direct |
| Zip / Zip_Code | americanZipCode | Direct |
| Address1 / Street_Address | addressStreetName | Direct |
| Billing_Type | type | Map (NET30, COD, etc.) |
| Contact_Name | → Contact.firstName/lastName | Split on space |
| Contact_Phone | → Contact.phone | Direct |
| Contact_Email | → Contact.email | Direct |

#### Drivers
| Key Column | DF Field | Transform |
|-----------|----------|-----------|
| Driver_Name | name | Direct |
| Driver_Number / Driver_Code | code | Direct |
| First_Name | firstName | Direct |
| Last_Name | surName | Direct |
| Cell_Phone / Mobile | personalMobile | Direct |
| Radio_Number | urgentMobile | Direct |
| Driver_Type | courierType | Map: "FT"→1, "IC"→2 |
| Status | active | "A"→true |
| Vehicle_Type | → vehicle lookup | Map to DF |
| License_Plate | vehicleRegoNo | Direct |
| Email | email | Direct |

#### Zones/Areas
| Key Column | DF Field | Transform |
|-----------|----------|-----------|
| Zone_Name / Area_Name | name | Direct |
| Zip_Code | zips[].zip | Direct |
| Zone_Number / Area_Number | zips[].zoneNumber | Direct |
| Description / City_Name | zips[].location | Direct |

#### Rate Schedules
| Key Column | DF Field | Transform |
|-----------|----------|-----------|
| Rate_Schedule_Name | name | Direct |
| Account_Number | clientId | Lookup |
| Service_Type / Priority | speedId | Map |
| Vehicle_Class | vehicle | Map |
| From_Miles | startDistance | Direct |
| To_Miles | endDistance | Direct |
| Base_Amount / Base_Charge | baseCharge | Direct |
| Per_Mile | perDistanceUnit | Direct |
| Dead_Head_Miles | distanceIncluded | Direct |
| From_Weight / Min_Wt | minWeight | Direct |
| To_Weight / Max_Wt | maxWeight | Direct |
| Weight_Charge | rate | Direct |

---

### 3. Datatrac

**Export method**: DatatracWeb reports → CSV/Excel, or SQL export
**Known modules**: Order Management, Dispatch, Rating & Settlement, Billing & AR

**Expected CSV columns → DF mapping:**

#### Clients
| Datatrac Column | DF Field | Transform |
|----------------|----------|-----------|
| CompanyName / Company | name | Direct |
| CompanyCode / CustCode | code | Direct |
| LegalEntity | legalName | Direct |
| PhoneMain / Phone | phone | Direct |
| EmailMain / Email | email | Direct |
| StatusCode | active | "ACT"→true, "INA"→false |
| City | americanCity | Direct |
| State / StateProvince | americanState | Normalize |
| PostalCode / Zip | americanZipCode | Direct |
| Address1 / StreetAddr | addressStreetName | Direct |
| BillMethod | type | Map |
| ContactFirst | → Contact.firstName | Direct |
| ContactLast | → Contact.lastName | Direct |

#### Drivers/Contractors
| Datatrac Column | DF Field | Transform |
|----------------|----------|-----------|
| DriverName / DisplayName | name | Direct |
| DriverNumber / DriverID | code | Direct |
| FirstName | firstName | Direct |
| LastName | surName | Direct |
| CellPhone | personalMobile | Direct |
| DispatchPhone | urgentMobile | Direct |
| Classification | courierType | Map: "EMP"→internal, "IC"→contractor |
| Status | active | "Active"→true |
| VehicleType | → vehicle lookup | Map |
| PlateNumber / TagNo | vehicleRegoNo | Direct |
| LoginEmail | email | Direct |

#### Zones
| Datatrac Column | DF Field | Transform |
|----------------|----------|-----------|
| ZoneName / ServiceArea | name | Direct |
| ZipCode / PostalCode | zips[].zip | Direct |
| ZoneID / AreaID | zips[].zoneNumber | Direct |
| CityName / Locality | zips[].location | Direct |

#### Pricing/Tariffs
| Datatrac Column | DF Field | Transform |
|----------------|----------|-----------|
| TariffName / RateSchedule | name | Direct |
| CustomerCode | clientId | Lookup |
| ServiceLevel / Priority | speedId | Map |
| VehicleCategory | vehicle | Map |
| MilesFrom | startDistance | Direct |
| MilesTo | endDistance | Direct |
| BasePrice / FlatFee | baseCharge | Direct |
| MileageRate | perDistanceUnit | Direct |
| FreeDistance | distanceIncluded | Direct |
| WeightFrom / LbsMin | minWeight | Direct |
| WeightTo / LbsMax | maxWeight | Direct |
| WeightCharge | rate | Direct |

---

### 4. Crown (Crown Courier Software)

**Export method**: Reports → CSV, or database export
**Known use**: Popular in AU/NZ market, some US presence

**Expected CSV columns → DF mapping:**

#### Clients
| Crown Column | DF Field | Transform |
|-------------|----------|-----------|
| ClientName / CustName | name | Direct |
| ClientCode / CustNo | code | Direct |
| TradingName | legalName | Direct |
| Telephone / Phone | phone | Direct |
| Email | email | Direct |
| Active | active | "Y"→true, "N"→false |
| Suburb / City | americanCity | Direct |
| State | americanState | Direct |
| PostCode / ZipCode | americanZipCode | Direct |
| Address / Street | addressStreetName | Direct |
| InvoiceFrequency | type | Map: "W"→Weekly, "M"→Monthly |

#### Drivers
| Crown Column | DF Field | Transform |
|-------------|----------|-----------|
| DriverName | name | Direct |
| DriverNo / DriverCode | code | Direct |
| FirstName / GivenName | firstName | Direct |
| Surname / FamilyName | surName | Direct |
| Mobile | personalMobile | Direct |
| WorkMobile | urgentMobile | Direct |
| DriverType | courierType | Map |
| Status | active | "A"→true |
| VehicleType | → vehicle lookup | Map |
| RegoNo / Registration | vehicleRegoNo | Direct |
| Email | email | Direct |

#### Zones/Suburbs
| Crown Column | DF Field | Transform |
|-------------|----------|-----------|
| ZoneName / AreaName | name | Direct |
| Postcode / ZipCode | zips[].zip | Direct |
| ZoneNo / AreaNo | zips[].zoneNumber | Direct |
| SuburbName / Locality | zips[].location | Direct |

#### Rates
| Crown Column | DF Field | Transform |
|-------------|----------|-----------|
| RateCardName / RateName | name | Direct |
| ClientCode | clientId | Lookup |
| ServiceCode / Priority | speedId | Map |
| VehicleType | vehicle | Map |
| DistFrom / KmFrom | startDistance | Convert km→miles if needed |
| DistTo / KmTo | endDistance | Convert km→miles if needed |
| BaseCharge / FlatRate | baseCharge | Direct |
| PerKm / PerMile | perDistanceUnit | Convert if km-based |
| IncludedKm / IncludedDist | distanceIncluded | Convert if needed |
| WeightFrom | minWeight | Convert kg→lbs if needed |
| WeightTo | maxWeight | Convert kg→lbs if needed |
| WeightRate | rate | Direct |

---

### 5. eCourier (TMS Platform — not the UK courier service)

**Export method**: Admin panel → Reports → CSV
**Note**: Less common in US market. If referring to a different system, column names need validation.

#### Clients
| eCourier Column | DF Field | Transform |
|----------------|----------|-----------|
| AccountName | name | Direct |
| AccountRef | code | Direct |
| Phone | phone | Direct |
| Email | email | Direct |
| Status | active | Map |
| City | americanCity | Direct |
| State | americanState | Direct |
| Zipcode | americanZipCode | Direct |
| Address | addressStreetName | Direct |

*(Similar pattern to above for Drivers, Zones, Rates)*

---

## Smart Import Engine Design

### Column Auto-Detection

The import engine should:

1. **Read CSV headers** and normalize (lowercase, strip spaces/underscores)
2. **Score against each competitor profile** — which system does this look like?
3. **Auto-map columns** based on the matching profile
4. **Show the mapping to the user** for review/correction
5. **Transform values** (status codes, unit conversions, name splitting)

### Fuzzy Header Matching Rules

```
"account_name" | "accountname" | "customer_name" | "company" | "company_name" → name
"acct_no" | "account_number" | "customer_code" | "client_code" → code
"first" | "first_name" | "firstname" | "given_name" → firstName
"last" | "last_name" | "lastname" | "surname" | "family_name" → surName
"cell" | "mobile" | "cell_phone" | "cellphone" | "personal_mobile" → personalMobile
"zip" | "zipcode" | "zip_code" | "postal_code" | "postcode" → americanZipCode
```

### Unit Conversions (AU/NZ → US)
- Kilometers → Miles: × 0.621371
- Kilograms → Pounds: × 2.20462
- AUD/NZD → USD: Apply exchange rate (configurable)

### Data Validation
- Phone numbers: Normalize to E.164 or US format
- States: Normalize to 2-letter abbreviation
- Zip codes: Validate format (5-digit or 5+4)
- Email: Basic format validation
- Duplicates: Flag duplicate client names/codes

### Import Progress Tracking
Each import session tracks:
- Total rows parsed
- Rows mapped successfully
- Rows with warnings (missing required fields)
- Rows with errors (validation failures)
- Entity IDs created in DF (for rollback)

---

## Implementation Priority

1. **Generic CSV** — Header detection + manual mapping (works for ANY system)
2. **Key Software** — Most common among US targets (300+ carriers)
3. **CXT Software** — Growing competitor, common at CLDA/ECA
4. **Datatrac** — 40+ years, large installed base
5. **Crown** — AU/NZ market, relevant for DF's home market
6. **eCourier** — Lower priority, validate which system Steve means

---

## Frontend UX (Setup Dashboard Step 2)

```
┌──────────────────────────────────────────┐
│ 📋 Import Your Clients                   │
│                                          │
│  ┌──────────┐  ┌──────────┐              │
│  │ Drop CSV │  │ I'm from │              │
│  │   here   │  │ ▼ Select │              │
│  └──────────┘  └──────────┘              │
│                                          │
│  System detected: Key Software ✅         │
│                                          │
│  Column Mapping:                         │
│  ┌────────────────┬──────────────────┐   │
│  │ Your CSV       │ Maps to DF       │   │
│  ├────────────────┼──────────────────┤   │
│  │ Account_Name   │ ✅ Client Name   │   │
│  │ Acct_No        │ ✅ Client Code   │   │
│  │ Phone1         │ ✅ Phone         │   │
│  │ Zip_Code       │ ✅ Zip Code      │   │
│  │ Bill_Method    │ ⚠️ Review →      │   │
│  │ Custom_Field_1 │ ❌ Not mapped    │   │
│  └────────────────┴──────────────────┘   │
│                                          │
│  📊 150 clients • 3 warnings • 0 errors  │
│                                          │
│  [Preview Import]  [Import All →]        │
└──────────────────────────────────────────┘
```
