/**
 * REV Robotics Shop All catalog — complete enumeration (Firecrawl walk, Oct 2026).
 *
 * REV Robotics publishes no verified public full-catalog feed, so this seed
 * IS the vendor's feed for the Parts workspace. Collection: keyless Firecrawl
 * scraped https://www.revrobotics.com/shop-all/?page=N for N=1..20 until an
 * empty page (19 pages x 20 + final 12 = 372 unique products; page 20
 * empty = pagination walked to its end). Names/SKUs/prices cross-checked
 * against the hand transcription in attached_assets/Pasted-REV-*.txt (2
 * discontinued items dropped, 4 new/renamed items added).
 *
 * Every record carries the real product page URL and listing image. Prices
 * are listing text (ranges for variant families), not verified live quotes.
 * The catalog sync merges this seed for `rev-robotics` on every run (see
 * collectPublicVendorCatalog), so re-syncs never wipe it.
 * Generated — do not edit by hand.
 */
export type RevCatalogSeedRecord = {
  vendorKey: "rev-robotics";
  externalKey: string;
  name: string;
  sku: string | null;
  category: string | null;
  description: string | null;
  productUrl: string | null;
  imageUrl: string | null;
};

export const REV_CATALOG_SEED_COUNT = 372;

export const REV_CATALOG_SEED: RevCatalogSeedRecord[] = [
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:t-rev-plushies",
    "name": "T-REV Plushies",
    "sku": null,
    "category": "Merch",
    "description": "$12.00 - $20.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/T-rev-plushies",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/955/3884/REV-54-9502-9223_TREV_Plush_Family_FINAL_1__50098.1791922425.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-21-3006",
    "name": "4in EasySwerve Module",
    "sku": "REV-21-3006",
    "category": "Drivetrain",
    "description": "REV-21-3006 · $223.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-21-3006/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/911/3678/REV-21-3006_EasySwerve_Hero-FINAL__02284.1764980057.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-21-1652",
    "name": "NEO Vortex Brushless Motor",
    "sku": "REV-21-1652",
    "category": "Motors",
    "description": "REV-21-1652 · $90.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-21-1652/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/784/3224/REV-11-1652-NEOVortexBrushlessMotor-Hero-FINAL__08884.1704233487.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-11-2159",
    "name": "SPARK Flex Motor Controller",
    "sku": "REV-11-2159",
    "category": "Electronics & Control",
    "description": "REV-11-2159 · $110.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-11-2159/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/785/3228/REV-11-2159-SPARKFlexMotorController-Hero-FINAL__85152.1704233534.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-11-2858",
    "name": "Flex Dock",
    "sku": "REV-11-2858",
    "category": "Parts",
    "description": "REV-11-2858 · $32.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-11-2858/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/787/3392/REV-11-2858-SPARKFlexDock-Hero-FINAL__85197.1733338054.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-11-2828",
    "name": "NEO Vortex Solo Adapter",
    "sku": "REV-11-2828",
    "category": "Motors",
    "description": "REV-11-2828 · $21.75 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-11-2828/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/786/3276/REV-11-2128-NEOVortexSoloAdapter-Hero-FINAL__39181.1706728162.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-21-6801",
    "name": "Vortex Shaft - 20DP Gear - 8T",
    "sku": "REV-21-6801",
    "category": "Gears, Chain & Belts",
    "description": "REV-21-6801 · $15.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-21-6801/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/935/3737/REV-21-6801_VortexShaft_Top_FINAL__82266.1767887479.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-21-2849",
    "name": "Vortex Shaft - 15T Spline",
    "sku": "REV-21-2849",
    "category": "Shafts & Axles",
    "description": "REV-21-2849 · $13.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-21-2849/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/857/3407/REV-21-2849-VortexShaft-15TSpline-Top-FINAL__05008.1733516545.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-21-2848",
    "name": "Vortex Shaft - MAXSwerve Integrated Key",
    "sku": "REV-21-2848",
    "category": "Drivetrain",
    "description": "REV-21-2848 · $11.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-21-2848/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/812/3207/REV-21-2800-Shaft1-FINAL__27396.1698077982.1280.1280__76890.1698085941.1280.1280__26226.1703701486.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-21-6800",
    "name": "Vortex Shaft - 20DP Gear - 7T",
    "sku": "REV-21-6800",
    "category": "Gears, Chain & Belts",
    "description": "REV-21-6800 · $15.25 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-21-6800/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/811/3636/REV-21-6800_VortexShaft7T_FINAL__80466.1764193351.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-21-2827",
    "name": "Vortex Shaft - Falcon Compatible Spline",
    "sku": "REV-21-2827",
    "category": "Shafts & Axles",
    "description": "REV-21-2827 · $12.00 $10.20 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-21-2827/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/810/3205/REV-21-2800-Shaft4-FINAL__99710.1698077344.1280.1280__90550.1698085810.1280.1280__69789.1703701297.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-21-2807",
    "name": "Vortex Shaft - 8mm",
    "sku": "REV-21-2807",
    "category": "Shafts & Axles",
    "description": "REV-21-2807 · $11.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-21-2807/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/809/3204/REV-21-2807-NEOVortexShaft8mm-FINAL__71506.1700160299.1280.1280__13655.1703701173.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-21-2130",
    "name": "Vortex MAXPlanetary Input Kit",
    "sku": "REV-21-2130",
    "category": "Gearboxes",
    "description": "REV-21-2130 · $17.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-21-2130/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/808/3201/REV-21-2127-MAXPlanetaryMotorOutputShaft-FINAL__83521.1698077270.1280.1280__65753.1698085692.1280.1280__08721.1703701033.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-21-4426",
    "name": "Unofficial Hub Funnel Kit - FRC 2026",
    "sku": "REV-21-4426",
    "category": "Kits & Bundles",
    "description": "REV-21-4426 · $120.00 $60.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-21-4426/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/952/3744/REV-21-4426_Funnel_Edited_Final__82721.1768002993.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-11-2158",
    "name": "SPARK MAX Motor Controller",
    "sku": "REV-11-2158",
    "category": "Electronics & Control",
    "description": "REV-11-2158 · $100.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-11-2158/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/360/2795/MAX_HERO-noflag__60247.1692730069.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-21-1653",
    "name": "NEO 2.0 Brushless Motor",
    "sku": "REV-21-1653",
    "category": "Motors",
    "description": "REV-21-1653 · $55.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-21-1653/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/914/3599/NEO2.0_TOP_FINAL__19534.1761063424.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-21-1651",
    "name": "NEO 550 Brushless Motor",
    "sku": "REV-21-1651",
    "category": "Motors",
    "description": "REV-21-1651 · $30.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-21-1651/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/508/2730/REV-21-1651-NEO550-iso-noflag-FINAL__53096.1650561900.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-45-3248",
    "name": "Servo Bundle V2",
    "sku": "REV-45-3248",
    "category": "Servo Accessories",
    "description": "REV-45-3248 · $400.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-45-3248/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/956/3757/Servo_Bundle_V2-FINAL__24463.1768431199.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-21-3005",
    "name": "3in MAXSwerve Module",
    "sku": "REV-21-3005",
    "category": "Drivetrain",
    "description": "REV-21-3005 · $275.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-21-3005/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/767/3496/REV-21-3005-3in1MAXSwerveModule_HERO-FINAL__58006.1748537163.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-21-2131",
    "name": "MAXPlanetary 1:1 Brake Cartridge",
    "sku": "REV-21-2131",
    "category": "Gearboxes",
    "description": "REV-21-2131 · $100.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-21-2131/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/922/3621/1_1Brake_HERO_Final__37110.1763502507.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-11-1850-rfb",
    "name": "Power Distribution Hub Repair Service",
    "sku": "REV-11-1850-RFB",
    "category": "Electronics & Control",
    "description": "REV-11-1850-RFB · $120.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-11-1850-rfb/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/779/3248/REV-11-1850-RFB-Power_Distribution_Hub_Repair_Service-V1.1__59654.1704388647.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:maxswerve-spare-parts",
    "name": "MAXSwerve Spare Parts",
    "sku": null,
    "category": "Drivetrain",
    "description": "$2.75 - $32.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/MAXSwerve-Spare-Parts/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/776/3350/REV-21-3005-P23-MAXSwerve-Spare_Parts-HERO__23215.1728327233.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-21-3002",
    "name": "3in MAXSwerve Wheel - Aluminum",
    "sku": "REV-21-3002",
    "category": "Drivetrain",
    "description": "REV-21-3002 · $20.00 $17.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-21-3002/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/774/3125/REV-21-3002-MAXSwerveAluminumWheel-Hero-FINAL__54573.1677188290.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-31-1596-rfb",
    "name": "Driver Hub Repair Service",
    "sku": "REV-31-1596-RFB",
    "category": "Electronics & Control",
    "description": "REV-31-1596-RFB · $125.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-31-1596-rfb/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/770/3083/REV-31-1596-RFB-Driver_Hub_Repair_Service__75656.1673535944.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-15-2992",
    "name": "3in MAXSwerve Motor & Controller Bundle",
    "sku": "REV-15-2992",
    "category": "Drivetrain",
    "description": "REV-15-2992 · $280.00 · Out of stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-15-2992/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/766/3069/MAXSwerve-Pre-Order-Bundle__57287.1671736590.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:3-16in-rivets",
    "name": "3/16in Rivets",
    "sku": null,
    "category": "Hardware",
    "description": "$6.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/3/16in-Rivets/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/763/3063/REV-21-0000-2970-2972-Rivets-FamilyHero-FINAL__00032.1670950838.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:tube-nuts-for-3-4in-dead-axle-tube",
    "name": "Tube Nuts for 3/4in Dead Axle Tube",
    "sku": null,
    "category": "Shafts & Axles",
    "description": "$11.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/Tube-Nuts-for-3/4in-Dead-Axle-Tube/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/762/3092/REV-21-0000-2380-2383-TubeNuts-FamilyHero-FINAL__61326.1673990753.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-21-2617",
    "name": "#25 Chain Turnbuckle",
    "sku": "REV-21-2617",
    "category": "Gears, Chain & Belts",
    "description": "REV-21-2617 · $11.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-21-2617/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/761/3089/REV-21-2617-25ChainTurnbuckle-Hero-FINAL__46220.1673990515.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-41-3205",
    "name": "Rounded UltraHex Shaft - 36in Long",
    "sku": "REV-41-3205",
    "category": "Shafts & Axles",
    "description": "REV-41-3205 · $13.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-41-3205/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/760/3123/REV-41-3205-RoundedUltraHexShaft-Hero-FINAL__17364.1676043975.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-21-2120",
    "name": "MAX 90 Degree Gearbox",
    "sku": "REV-21-2120",
    "category": "Gearboxes",
    "description": "REV-21-2120 · $95.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-21-2120/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/759/3870/REV_21-2120_MAX90Gearbox_Edited-FINAL_Assembled-Hero_1__80113.1785362885.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-21-2995",
    "name": "3in MAXSwerve Module Wheel Hardware Pack",
    "sku": "REV-21-2995",
    "category": "Drivetrain",
    "description": "REV-21-2995 · $32.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-21-2995/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/756/3040/REV-21-2995-MAXSwerveModuleWheelHardwarePack-Iso-FINAL__59506.1669756437.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-21-2124",
    "name": "MAXPlanetary 14T Spline Input Coupler",
    "sku": "REV-21-2124",
    "category": "Gearboxes",
    "description": "REV-21-2124 · $8.00 $6.80 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-21-2124/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/751/3616/2018_source_1722889431__04123.1761842832.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:10-32-ball-joint-rod-ends",
    "name": "#10-32 Ball Joint Rod Ends",
    "sku": null,
    "category": "Hardware",
    "description": "$8.75 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/10-32-Ball-Joint-Rod-Ends/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/750/3024/REV-21-2596-2597-BallJointRodEnds-Family-FINAL__61198.1668111921.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-45-2470",
    "name": "Mecanum Drivetrain Kit V2",
    "sku": "REV-45-2470",
    "category": "Drivetrain",
    "description": "REV-45-2470 · $520.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-45-2470/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/734/2957/REV-45-1877-MecanumDrivetrain-Hero-FINAL__65654.1662478219.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-19-2487-pk2",
    "name": "MK Battery ES17-12 - 2 Pack",
    "sku": "REV-19-2487-PK2",
    "category": "Batteries & Power",
    "description": "REV-19-2487-PK2 · $120.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-19-2487/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/733/2951/battery__38904.1660922625.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-21-2286-pk10",
    "name": "Bearing Retaining Plate - 10 Pack",
    "sku": "REV-21-2286-PK10",
    "category": "Bearings",
    "description": "REV-21-2286-PK10 · $11.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-21-2286/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/728/3095/REV-21-2286-BearingRetentionPlate-Hero-FINAL__26439.1673990842.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:m3-nylon-unthreaded-spacers",
    "name": "M3 Nylon Unthreaded Spacers",
    "sku": null,
    "category": "Hardware",
    "description": "$3.25 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/M3-Nylon-Unthreaded-Spacers/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/727/2914/REV-41-2880-M3NylonSpacer-Pile-FINAL__41463.1657219256.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-41-2886-pk100",
    "name": "M3 Stainless Steel Washer - 100 Pack",
    "sku": "REV-41-2886-PK100",
    "category": "Hardware",
    "description": "REV-41-2886-PK100 · $6.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-41-2886/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/726/2911/REV-41-2886-M3-Stainless-Steel-Washer-Pile-FINAL__97794.1657219248.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:maxspline-bearing-blocks",
    "name": "MAXSpline Bearing Blocks",
    "sku": null,
    "category": "Bearings",
    "description": "$15.25 - $26.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/MAXSpline-Bearing-Blocks/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/725/2984/REV-21-2550-MAXSplineBearingBlock-Hero-FINAL__99173.1692731088.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:maxtube-endcaps",
    "name": "MAXTube Endcaps",
    "sku": null,
    "category": "Structure",
    "description": "$5.50 - $7.75 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/MAXTube-Endcaps/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/724/2917/REV-21-2710-2712-MAXTubePlug-Hero-FINAL__65673.1659452519.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:5mm-hex-shafts",
    "name": "5mm Hex Shafts",
    "sku": null,
    "category": "Shafts & Axles",
    "description": "$12.50 - $23.25 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/5mm-Hex-Shafts/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/723/2895/REV-41-0000-5mm-Hex-Shafts-Hero-FINAL__26864.1654542780.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:duo-omni-wheels",
    "name": "DUO Omni Wheels",
    "sku": null,
    "category": "Wheels",
    "description": "$27.00 - $31.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/DUO-Omni-Wheels/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/721/2890/REV-41-0000-DUO-Omni-Wheels-Hero-FINAL__23968.1654286939.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:duo-traction-wheels",
    "name": "DUO Traction Wheels",
    "sku": null,
    "category": "Wheels",
    "description": "$12.50 - $20.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/DUO-Traction-Wheels/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/720/2887/REV-41-0000-DUO-Traction-Wheel--Hero-FINAL__46920.1654284261.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:duo-round-belt-pulleys",
    "name": "DUO Round Belt Pulleys",
    "sku": null,
    "category": "Gears, Chain & Belts",
    "description": "$8.75 - $11.00 · REV Robotics Shop All (Firecrawl listing scrape, Oct 2026)",
    "productUrl": "https://www.revrobotics.com/DUO-Round-Belt-Pulleys/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/719/2870/REV-41-0000-Round-Belt-Pulleys-Hero-FINAL__99617.1654090679.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:through-bore-bearings",
    "name": "Through Bore Bearings",
    "sku": null,
    "category": "Bearings",
    "description": "$5.00 - $7.75 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/Through-Bore-Bearings/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/718/2906/REV-41-0000-ThroughBoreBearing-Hero-FINAL__95714.1654628521.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:5mm-hex-spacers",
    "name": "5mm Hex Spacers",
    "sku": null,
    "category": "Hardware",
    "description": "$6.00 - $7.75 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/5mm-Hex-Spacers/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/717/2904/REV-41-0000-5mmHexSpacers-Hero-FINAL__66146.1654620358.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:5mm-metal-hex-bore-gears",
    "name": "5mm Metal Hex Bore Gears",
    "sku": null,
    "category": "Gears, Chain & Belts",
    "description": "$9.75 - $10.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/5mm-Metal-Hex-Bore-Gears/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/715/2903/REV-41-0000-15mmPlasticMotionBrackets-Hero-FINAL_1__03190.1654613623.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:5mm-plastic-hex-bore-gears",
    "name": "5mm Plastic Hex Bore Gears",
    "sku": null,
    "category": "Gears, Chain & Belts",
    "description": "$5.00 - $8.75 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/5mm-Plastic-Hex-Bore-Gears/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/714/2902/REV-41-0000-PlasticGears-HEro-FINAL__71233.1654613518.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:ultraplanetary-brackets",
    "name": "UltraPlanetary Brackets",
    "sku": null,
    "category": "Gearboxes",
    "description": "$7.75 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/UltraPlanetary-Brackets/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/713/2901/REV-41-0000-UltraPlanetaryBrackets-Hero-FINAL__26867.1654613474.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:duo-plastic-25-sprockets",
    "name": "DUO Plastic #25 Sprockets",
    "sku": null,
    "category": "Gears, Chain & Belts",
    "description": "$5.00 - $8.75 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/DUO-Plastic-25-Sprockets/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/712/2900/REV-41-0000-25Sprockets-Hero-FINAL__23030.1654613432.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:15mm-metal-motion-brackets",
    "name": "15mm Metal Motion Brackets",
    "sku": null,
    "category": "Structure",
    "description": "$5.50 - $6.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/15mm-Metal-Motion-Brackets/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/711/2899/REV-41-0000-15mmMetalMotionBrackets-Hero-final__04816.1654613290.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:15mm-metal-brackets",
    "name": "15mm Metal Brackets",
    "sku": null,
    "category": "Structure",
    "description": "$12.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/15mm-Metal-Brackets/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/710/2909/REV-41-0000-15mmMetalBrackets-Hero-final__04568.1655156659.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:15mm-plastic-motion-brackets",
    "name": "15mm Plastic Motion Brackets",
    "sku": null,
    "category": "Structure",
    "description": "$4.00 - $6.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/15mm-Plastic-Motion-Brackets/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/709/2897/REV-41-0000-15mmPlasticMotionBrackets-Hero-FINAL__74609.1654613121.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:15mm-plastic-brackets",
    "name": "15mm Plastic Brackets",
    "sku": null,
    "category": "Structure",
    "description": "$5.00 - $6.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/15mm-Plastic-Brackets/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/708/2896/REV-41-0000-15mmPlasticBrackets-Hero-FINAL__04319.1654542861.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:10-32-button-head-hex-drive-screws",
    "name": "#10-32 Button Head Hex Drive Screws",
    "sku": null,
    "category": "Hardware",
    "description": "$4.50 - $12.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/10-32-Button-Head-Hex-Drive-Screws/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/703/2995/REV-29-0000-10-32-ButtonHeadSocketCapScrew-New-HeroFINAL__42827.1666205128.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:10-32-socket-head-screws",
    "name": "#10-32 Socket Head Screws",
    "sku": null,
    "category": "Hardware",
    "description": "$4.50 - $32.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/10-32-Socket-Head-Screws/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/702/2996/REV-29-0000-10-32-SocketHexCapScrew-New-Hero-FINAL__94714.1666205172.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:rt25-pulleys",
    "name": "RT25 Pulleys",
    "sku": null,
    "category": "Gears, Chain & Belts",
    "description": "$6.50 - $13.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/RT25-Pulleys/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/699/3306/REV-21-2200-RT25Pulleys-FamilyHero-May2024-FINAL__59764.1716584345.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:rt25-belts-1-2in-width",
    "name": "RT25 Belts - 1/2in Width",
    "sku": null,
    "category": "Gears, Chain & Belts",
    "description": "$2.75 - $15.25 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/RT25-Belts-1/2in-Width/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/698/2669/4120-edit__69834.1650404239.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:ion-servo-accessories",
    "name": "ION Servo Accessories",
    "sku": null,
    "category": "Servo Accessories",
    "description": "$4.50 - $6.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/ION-Servo-Accessories/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/697/3120/REV-21-2890-2899-IONServoAccessories-FamilyHero-FINAL__04041.1676043295.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:ion-maxspline-shaft-collars",
    "name": "ION MAXSpline Shaft Collars",
    "sku": null,
    "category": "Shafts & Axles",
    "description": "$6.00 - $7.25 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/ION-MAXSpline-Shaft-Collars",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/691/3842/REV-21-2581-3476_ShaftCollarFinaly_Edited_FINAL__69187.1780433549.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-21-2396",
    "name": "Stepped Bushing - 3/4in ID",
    "sku": "REV-21-2396",
    "category": "Bearings",
    "description": "REV-21-2396 · $4.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-21-2396/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/690/3008/REV-21-2396-SteppedBrushing-Hero-FINAL__28885.1666891504.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-21-2394-pk10",
    "name": "External Retaining Ring - 3/4in - 10 Pack",
    "sku": "REV-21-2394-PK10",
    "category": "Hardware",
    "description": "REV-21-2394-PK10 · $6.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-21-2394/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/688/2844/REV-21-2394__50367.1650317864.1280.1280__26150.1652130932.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-21-2056-pk10",
    "name": "#10-32 Shaft End Screw - 10 Pack",
    "sku": "REV-21-2056-PK10",
    "category": "Shafts & Axles",
    "description": "REV-21-2056-PK10 · $15.00 $12.75 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-21-2056/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/681/2595/REV-21-2056-1032ShaftEndScrew-Iso-FINAL__95339.1649960768.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-21-2078-pk50",
    "name": "8mm Shaft Spacer - 1/8in - 50 Pack",
    "sku": "REV-21-2078-PK50",
    "category": "Shafts & Axles",
    "description": "REV-21-2078-PK50 · $13.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-21-2078/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/673/2994/REV-21-2078-8mmShaftSpacer-Hero-FINAL__70718.1666198427.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-19-2491-pk50",
    "name": "WAGO 221 Inline Splicing Connector - 12 AWG - 50 Pack",
    "sku": "REV-19-2491-PK50",
    "category": "Cables & Connectors",
    "description": "REV-19-2491-PK50 · $35.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-15-2491/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/654/2568/REV-19-2490-WAGO-Hero-FINAL__79462.1645201543.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:clamping-elevator-bearing-block-2pk",
    "name": "Clamping Elevator Bearing Block - 2PK",
    "sku": null,
    "category": "Bearings",
    "description": "$21.75 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/Elevator-Bearing-Blocks/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/653/3453/REV-21-2636-ClampingElevatorBearingBlock-ApplicationExample-FINAL__81328.1734474860.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-21-2468-pk2",
    "name": "SPARK MAX Mounting Bracket - 2 Pack",
    "sku": "REV-21-2468-PK2",
    "category": "Electronics & Control",
    "description": "REV-21-2468-PK2 · $6.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-21-2468-pk2/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/647/2516/REV-21-2151-SPARKMAXMountBracket-Hero-FINAL__42719.1642015026.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-21-2117",
    "name": "MAXPlanetary 550 Input Kit",
    "sku": "REV-21-2117",
    "category": "Gearboxes",
    "description": "REV-21-2117 · $6.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-21-2117/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/621/2518/REV-21-2117-550InputKit-Hero-FINAL__62718.1642025185.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-21-2118",
    "name": "MAXPlanetary 775 Input Kit",
    "sku": "REV-21-2118",
    "category": "Gearboxes",
    "description": "REV-21-2118 · $6.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-21-2118/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/620/2520/REV-21-2118-775InputKit-Hero-FINAL__29298.1642025191.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:duo-compliant-wheels",
    "name": "DUO Compliant Wheels",
    "sku": null,
    "category": "Wheels",
    "description": "$19.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/duo-compliant-wheels/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/613/2332/REV-41-20342035-CompliantWheel2in5mmHex-LightandDark-FINAL__99141.1634920157.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:duo-grip-wheels",
    "name": "DUO Grip Wheels",
    "sku": null,
    "category": "Wheels",
    "description": "$13.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/DUO-Grip-Wheels/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/612/2336/REV-41-21492150-GripWheel1in5mmHex-LightandDark-FINAL__93706.1634921354.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-31-1876",
    "name": "Driver Hub Battery",
    "sku": "REV-31-1876",
    "category": "Electronics & Control",
    "description": "REV-31-1876 · $21.75 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-31-1876/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/609/2179/REV-31-1876---Driver-Hub-Battery-FINAL__71069.1631043369.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-11-1856",
    "name": "Radio Power Module",
    "sku": "REV-11-1856",
    "category": "Electronics & Control",
    "description": "REV-11-1856 · $40.00 $34.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-11-1856/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/601/3249/REV-11-1856-RadioPowerModule-Hero-FINAL__11706.1704391002.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-11-1880-pk2",
    "name": "SPARK CAN Cable V2 - 2 Pack",
    "sku": "REV-11-1880-PK2",
    "category": "Electronics & Control",
    "description": "REV-11-1880-PK2 · $6.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-11-1880/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/599/2078/REV-11-1880-SPARK-MAX-CAN-Cable-V2-FINAL__94523.1620762555.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-31-1596",
    "name": "Driver Hub",
    "sku": "REV-31-1596",
    "category": "Electronics & Control",
    "description": "REV-31-1596 · $275.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-31-1596/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/598/2741/REV-31-1596-Driver_Hub-Iso_View-FINAL__03867.1650564025.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:neo-pinions",
    "name": "NEO Pinions",
    "sku": null,
    "category": "Motors",
    "description": "$9.75 - $11.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/neo-pinions/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/588/1850/REV-21-0000-Pinion_Gear-Family-FINAL__60560.1612816510.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:550-motor-pinions",
    "name": "550 Motor Pinions",
    "sku": null,
    "category": "Motors",
    "description": "$8.75 - $11.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/550-motor-pinions/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/577/2295/REV-21-1908-REV-41-1660-REV-41-1608-550MotorPinions-Hero-FINAL__39131.1633702747.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-31-2010-pk4",
    "name": "Digital LED Indicator - Red/Green - 4 Pack",
    "sku": "REV-31-2010-PK4",
    "category": "Electronics & Control",
    "description": "REV-31-2010-PK4 · $14.75 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-31-2010/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/576/1784/REV-31-2010-Digital-LED-Indicator-Back-FINAL__95304.1670952526.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-31-1807",
    "name": "USB Female A to Micro USB Adapter - Orange",
    "sku": "REV-31-1807",
    "category": "Cables & Connectors",
    "description": "REV-31-1807 · $7.75 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-31-1807/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/575/2073/REV-31-1807-USB_Female_A_to_Micro_USB_Adapter-Side-FINAL__58371.1620666063.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-21-1879",
    "name": "8mm to 1/2in Hex Adapter",
    "sku": "REV-21-1879",
    "category": "Parts",
    "description": "REV-21-1879 · $11.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-21-1879/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/574/1843/REV-21-1879-8mm-to-0.5-inch-Hex-FINAL__16959.1614451290.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-31-1595-rfb",
    "name": "Control Hub Repair Service",
    "sku": "REV-31-1595-RFB",
    "category": "Electronics & Control",
    "description": "REV-31-1595-RFB · $165.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-31-1595-rfb/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/573/3878/REV-31-1595_RepairService_Edited_FINAL__75955.1789595581.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-21-2052-pk5",
    "name": "36in CAN Extension Cable - 5 Pack",
    "sku": "REV-21-2052-PK5",
    "category": "Cables & Connectors",
    "description": "REV-21-2052-PK5 · $12.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-21-2052/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/564/3706/REV-21-2052_36inCANCable_Hero-FINAL__14887.1765232054.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-41-1828",
    "name": "Aluminum Servo Horn V2",
    "sku": "REV-41-1828",
    "category": "Servo Accessories",
    "description": "REV-41-1828 · $7.75 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-41-1828/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/561/1682/Servo_Horn_V2__52778.1600185784.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-45-1905",
    "name": "M3 Hardware Bundle",
    "sku": "REV-45-1905",
    "category": "Kits & Bundles",
    "description": "REV-45-1905 · $200.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-45-1905/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/552/1704/M3_Hardware_Bundle_V3__29076.1603470270.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-45-1886",
    "name": "FTC Timing Belt & Pulley Bundle",
    "sku": "REV-45-1886",
    "category": "Gears, Chain & Belts",
    "description": "REV-45-1886 · $223.75 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-45-1886/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/551/1691/FTC-Timing-Belt-and-Pulley-Bundle_V3__67945.1600358544.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-45-1894",
    "name": "5mm Hex Shaft & Spacer Bundle",
    "sku": "REV-45-1894",
    "category": "Shafts & Axles",
    "description": "REV-45-1894 · $186.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-45-1894/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/550/1645/5mm_Hex_Shaft_Spacer_Bundle-REV-45-1894-FINAL-01__49240.1615482800.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-45-1901",
    "name": "FTC Cable Bundle",
    "sku": "REV-45-1901",
    "category": "Cables & Connectors",
    "description": "REV-45-1901 · $220.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-45-1901/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/549/1659/FTC_Cable_Bundle-FINAL__23209.1618524318.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-45-1899",
    "name": "M3 Standoff Bundle",
    "sku": "REV-45-1899",
    "category": "Hardware",
    "description": "REV-45-1899 · $110.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-45-1899/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/548/1693/M3_Standoff_Bundle_V2__19303.1603469811.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-45-1898",
    "name": "FTC Bearing Bundle",
    "sku": "REV-45-1898",
    "category": "Bearings",
    "description": "REV-45-1898 · $125.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-45-1898/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/547/1703/FTC_Bearing_Bundle_V4__85926.1603469776.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-45-1889",
    "name": "#25 Chain & Metal Sprocket Bundle",
    "sku": "REV-45-1889",
    "category": "Gears, Chain & Belts",
    "description": "REV-45-1889 · $366.25 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-45-1889/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/543/1705/25_Chain_and_Metal_Sprocket_Bundle_V3__24142.1603469740.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-45-1900",
    "name": "15mm Extrusion Lift Kit",
    "sku": "REV-45-1900",
    "category": "Structure",
    "description": "REV-45-1900 · $126.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-45-1900/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/542/2963/REV-45-1900-15mm-Extrusion-Lift-Kit-FINAL-09-27-2022__82718.1664292467.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-45-1885",
    "name": "FTC Sensor Bundle",
    "sku": "REV-45-1885",
    "category": "Electronics & Control",
    "description": "REV-45-1885 · $180.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-45-1885/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/541/2294/REV-45-1885-FTC-Sensor-Bundle-FINAL__03271.1633445573.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-41-1215",
    "name": "Storage Tote - Orange",
    "sku": "REV-41-1215",
    "category": "Parts",
    "description": "REV-41-1215 · $29.75 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-41-1215/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/537/1626/REV-41-1215_Storage_Tote-Orange__71967.1595267648.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-41-1907-pk25",
    "name": "M3 X 8MM T-Slot Screw - 25 Pack",
    "sku": "REV-41-1907-PK25",
    "category": "Hardware",
    "description": "REV-41-1907-PK25 · $9.25 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-41-1907-pk25/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/536/1624/REV-41-1907_M3_X_8mm_T-Slot_Screw-2__07783.1595265762.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-41-1846-pk8",
    "name": "Motion Pattern Spacer - 8 Pack",
    "sku": "REV-41-1846-PK8",
    "category": "Hardware",
    "description": "REV-41-1846-PK8 · $5.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-41-1846-pk8/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/534/1620/REV-41-1846_Motion_Pattern_Spacer-2__31441.1652188610.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-11-1729",
    "name": "4-pin JST PH to 4-pin roboRIO I2C Cable",
    "sku": "REV-11-1729",
    "category": "Cables & Connectors",
    "description": "REV-11-1729 · $4.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-11-1729/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/517/1555/JST_PH_4-Pin_to_RoboRio_I2C_Cable_CORRECTED__43065.1578697368.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-11-1817",
    "name": "JST PH 6-pin to 4 Channel PWM Encoder Adapter Cable - 1m",
    "sku": "REV-11-1817",
    "category": "Structure",
    "description": "REV-11-1817 · $7.75 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-11-1817/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/514/1556/JST_PH_6-Pin_to_4_Channel_PWM_Cable_CORRECTED__40088.1578697638.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-31-1815",
    "name": "JST PH 6-pin to JST PH 4-pin Encoder Adapter Cable - 50cm",
    "sku": "REV-31-1815",
    "category": "Cables & Connectors",
    "description": "REV-31-1815 · $4.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-31-1815/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/513/1542/JST_PH_6-Pin_to_JST_PH_4-Pin_Cable_50cm__22889.1578591885.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-41-1609",
    "name": "UltraPlanetary Hardware Pack",
    "sku": "REV-41-1609",
    "category": "Gearboxes",
    "description": "REV-41-1609 · $7.75 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-41-1609/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/483/3618/REV-41-1609_UltraPlanetaryHardware_FINAL__15583.1763138702.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-41-1603",
    "name": "UltraPlanetary Cartridge - 5:1",
    "sku": "REV-41-1603",
    "category": "Gearboxes",
    "description": "REV-41-1603 · $12.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-41-1603/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/482/1345/UltraPlanetary_Cartridge_Laying_Down__17448.1613072762.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-41-1602",
    "name": "UltraPlanetary Cartridge - 4:1",
    "sku": "REV-41-1602",
    "category": "Gearboxes",
    "description": "REV-41-1602 · $12.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-41-1602/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/481/1342/UltraPlanetary_Cartridge_Laying_Down__58665.1565907803.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-41-1601",
    "name": "UltraPlanetary Cartridge - 3:1",
    "sku": "REV-41-1601",
    "category": "Gearboxes",
    "description": "REV-41-1601 · $12.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-41-1601/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/480/1339/UltraPlanetary_Cartridge_Laying_Down__37922.1618525009.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-45-1655",
    "name": "DUO Mecanum Wheel Set",
    "sku": "REV-45-1655",
    "category": "Drivetrain",
    "description": "REV-45-1655 · $160.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-45-1655/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/453/1399/75mm_Mecanum_Wheel_Set_4_Wheels__36318.1788291024.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:1in-extrusion-4ft",
    "name": "1in Extrusion - 4ft",
    "sku": null,
    "category": "Structure",
    "description": "$20.00 - $21.75 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/1in-extrusion/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/389/2916/REV-21-0000-1in-Extrusion-Hero-FINAL__03397.1659382438.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-11-1278",
    "name": "SPARK MAX Data Port Breakout Board",
    "sku": "REV-11-1278",
    "category": "Electronics & Control",
    "description": "REV-11-1278 · $11.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-11-1278/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/387/3148/REV-11-1278-SPARKMAXDataPortBreakoutBoard-Hero-FINAL__90792.1695750718.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-11-1274-pk2",
    "name": "SPARK PWM Cable - 2 Pack",
    "sku": "REV-11-1274-PK2",
    "category": "Electronics & Control",
    "description": "REV-11-1274-PK2 · $4.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-11-1274/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/383/1281/SPARK_MAX_PWM_Cable_Detail__77742.1580147376.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-11-1229-pk10",
    "name": "PWM Cable Clip - 10 Pack",
    "sku": "REV-11-1229-PK10",
    "category": "Cables & Connectors",
    "description": "REV-11-1229-PK10 · $6.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-11-1229/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/382/1260/PWM_Cable_Clip_Working_Better__43274.1548199062.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-11-1228-pk10",
    "name": "SPARK MAX Data Port Cover - 10 Pack",
    "sku": "REV-11-1228-PK10",
    "category": "Electronics & Control",
    "description": "REV-11-1228-PK10 · $4.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-11-1228/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/381/1261/Data_Port_Cover_Pile__26228.1548199101.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-39-1224-pk4",
    "name": "Ferrite Cable Clip - 4 Pack",
    "sku": "REV-39-1224-PK4",
    "category": "Cables & Connectors",
    "description": "REV-39-1224-PK4 · $5.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-39-1224-pk4/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/377/1228/Ferrite_Clips_Pile__89855.1546030646.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:jst-ph-3-pin-communication-cables",
    "name": "JST PH 3-pin Communication Cables",
    "sku": null,
    "category": "Cables & Connectors",
    "description": "$5.00 - $7.75 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/JST-PH-3-Pin-Communication-Cables/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/363/1223/JST_PH_3-Pin_Comm__91198.1618525045.jpg?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-31-1269",
    "name": "Resistive Grounding Strap",
    "sku": "REV-31-1269",
    "category": "Parts",
    "description": "REV-31-1269 · $5.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-31-1269/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/358/1209/REV-31-1269-ResistiveGroundingStrap__52320.1536076938.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-41-1662",
    "name": "70 Tooth Metal Gear",
    "sku": "REV-41-1662",
    "category": "Gears, Chain & Belts",
    "description": "REV-41-1662 · $12.50 $10.63 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-41-1662/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/356/1195/70T__24263.1533945669.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-41-1664",
    "name": "42 Tooth Metal Gear",
    "sku": "REV-41-1664",
    "category": "Gears, Chain & Belts",
    "description": "REV-41-1664 · $10.00 $8.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-41-1664/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/354/1197/42T__49365.1533945550.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-45-1259",
    "name": "15mm Hinge Kit",
    "sku": "REV-45-1259",
    "category": "Hardware",
    "description": "REV-45-1259 · $12.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-45-1259/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/348/1200/Hinge_Kit__39838.1533944966.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-45-1507",
    "name": "15mm Linear Motion Kit V2",
    "sku": "REV-45-1507",
    "category": "Kits & Bundles",
    "description": "REV-45-1507 · $14.75 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-45-1507/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/347/1199/Linear_Motion__71955.1533944999.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-42-1442",
    "name": "#25 Chain Tool",
    "sku": "REV-42-1442",
    "category": "Gears, Chain & Belts",
    "description": "REV-42-1442 · $37.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-42-1442/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/346/1508/25_Chain_Tool_V3__78423.1615481416.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-41-1562-pk8",
    "name": "15mm Corner Cube - 8 Pack",
    "sku": "REV-41-1562-PK8",
    "category": "Parts",
    "description": "REV-41-1562-PK8 · $18.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-41-1562/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/345/1193/15mm_Corner_Cubes___20455.1613071954.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-41-1214",
    "name": "USB Retention Mount and Cable",
    "sku": "REV-41-1214",
    "category": "Structure",
    "description": "REV-41-1214 · $13.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-41-1214/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/343/2740/USB_Retention_Mount_Example__19448.1650563934.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-31-1293",
    "name": "XT30 Power Distribution Block",
    "sku": "REV-31-1293",
    "category": "Electronics & Control",
    "description": "REV-31-1293 · $14.75 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-31-1293/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/341/2695/XT30_Power_Distribution_Block_Hero_noflag__79425.1650555542.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-31-1505",
    "name": "2m Distance Sensor",
    "sku": "REV-31-1505",
    "category": "Electronics & Control",
    "description": "REV-31-1505 · $31.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-31-1505/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/340/2734/2M_Distance_Sensor__87798.1650562207.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-31-1230",
    "name": "SPARKmini Motor Controller",
    "sku": "REV-31-1230",
    "category": "Electronics & Control",
    "description": "REV-31-1230 · $35.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-31-1230/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/339/2709/Spark_Mini_Legal_TEMP-noflag__30764.1650558664.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-31-1153-rfb",
    "name": "Expansion Hub Repair Service",
    "sku": "REV-31-1153-RFB",
    "category": "Electronics & Control",
    "description": "REV-31-1153-RFB · $125.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-31-1153-rfb/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/337/1155/REV-31-1153_expansion_hub_Repair_Service__56281.1618523820.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-41-1453",
    "name": "Punch Tube - 1m",
    "sku": "REV-41-1453",
    "category": "Structure",
    "description": "REV-41-1453 · $12.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-41-1453/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/316/1084/REV-41-1453-1__13647.1513383650.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-11-1210",
    "name": "POE Injector Cable",
    "sku": "REV-11-1210",
    "category": "Electronics & Control",
    "description": "REV-11-1210 · $12.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-11-1210/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/290/1048/REV-11-1210-1__99321.1513383118.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-11-1105",
    "name": "Blinkin LED Driver",
    "sku": "REV-11-1105",
    "category": "Electronics & Control",
    "description": "REV-11-1105 · $49.68 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-11-1105/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/286/2715/Blinkin_Lone_Tilt__90547.1650559168.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-41-1064",
    "name": "20:1 Hex Gearbox & Pinion",
    "sku": "REV-41-1064",
    "category": "Gearboxes",
    "description": "REV-41-1064 · $17.00 $14.45 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-41-1064/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/283/2749/REV-41-1065-40-to-1-Hex-Gearbox--Pinion-NOFlag-FINAL__61202.1650564848.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-49-1455",
    "name": "Metric Step Drill",
    "sku": "REV-49-1455",
    "category": "Tools",
    "description": "REV-49-1455 · $9.75 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-49-1455/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/277/1035/Metric_Step_Drill__64060.1618523323.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:xt30-extension-cables",
    "name": "XT30 Extension Cables",
    "sku": null,
    "category": "Cables & Connectors",
    "description": "$9.25 - $10.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/XT30-Extension-Cables/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/267/905/XT30_extension__07089.1603473877.jpg?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:jst-vh-2-pin-motor-cables",
    "name": "JST VH 2-pin Motor Cables",
    "sku": null,
    "category": "Motors",
    "description": "$9.75 - $22.25 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/JST-VH-2-pin-Motor-Cables/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/265/2345/REV-31-1413-JSTVH-Hero-FINAL__66749.1636397287.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:jst-ph-4-pin-sensor-cables",
    "name": "JST PH 4-pin Sensor Cables",
    "sku": null,
    "category": "Electronics & Control",
    "description": "$7.75 - $14.75 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/JST-PH-4-pin-Sensor-Cables/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/263/876/JST_PH_4pin_30cm_REV-31-1407__92491.1613072598.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-31-1387",
    "name": "Switch Cable and Bracket",
    "sku": "REV-31-1387",
    "category": "Structure",
    "description": "REV-31-1387 · $13.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-31-1387/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/256/2679/REV-31-1387-Switch-Cable-and-Bracket-1-NoFlag-FINAL__58356.1650554802.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-31-1381-pk4",
    "name": "Anderson to JST VH Cable - 12 cm - 4 pack",
    "sku": "REV-31-1381-PK4",
    "category": "Cables & Connectors",
    "description": "REV-31-1381-PK4 · $25.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-31-1381-pk4/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/255/918/AA_15mm_Metal_Servo_Bracket__15222.1497285356.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-31-1386-pk2",
    "name": "Sensor Splitter Cable - 2 Pack",
    "sku": "REV-31-1386-PK2",
    "category": "Electronics & Control",
    "description": "REV-31-1386-PK2 · $6.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-31-1386-pk2/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/254/914/AA_Sensor_Splitter_Cable__32251.1497279914.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-31-1399-pk5",
    "name": "XT30 Connectors - 5 pairs",
    "sku": "REV-31-1399-PK5",
    "category": "Cables & Connectors",
    "description": "REV-31-1399-PK5 · $12.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-31-1399-pk5/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/252/2348/REV-31-1399-XT30_Connectors_Pile-FINAL__04315.1636407494.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-31-1384",
    "name": "Sensor Cable Adapter for Level Converter",
    "sku": "REV-31-1384",
    "category": "Electronics & Control",
    "description": "REV-31-1384 · $2.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-31-1384/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/248/2778/Sensor_Cable_dapter_for_Level_Shifter__76204.1650571151.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-31-1425",
    "name": "Touch Sensor",
    "sku": "REV-31-1425",
    "category": "Electronics & Control",
    "description": "REV-31-1425 · $8.75 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-31-1425/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/242/2785/Button_Sensor_REV-31-1425_2_not_lm__15755.1650572167.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-31-1389",
    "name": "Logic Level Converter",
    "sku": "REV-31-1389",
    "category": "Electronics & Control",
    "description": "REV-31-1389 · $7.75 $3.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-31-1389/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/241/2754/AA_Level_Shifter_Pack_One__54072.1650567826.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-45-1171",
    "name": "MiniBot Hardware Kit",
    "sku": "REV-45-1171",
    "category": "Kits & Bundles",
    "description": "REV-45-1171 · $186.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-45-1171/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/235/1225/Minibotkit__Parts_Two_Extrusion__64640.1689621266.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-41-1161-pk50",
    "name": "Zip Ties - Black - 160mm - 50 Pack",
    "sku": "REV-41-1161-PK50",
    "category": "Materials & Consumables",
    "description": "REV-41-1161-PK50 · $5.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-41-1161-pk50/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/232/820/Zipties_REV-41-1161_1__15802.1494520525.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-41-1373",
    "name": "Hook and Loop Fastener - 13.5mm x 2m",
    "sku": "REV-41-1373",
    "category": "Materials & Consumables",
    "description": "REV-41-1373 · $7.75 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-41-1373/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/231/817/Velcro_REV-41-1373_1__79285.1615482398.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-41-1165-pk8",
    "name": "Barb for Polyurethane Hollow Belt - 8 Pack",
    "sku": "REV-41-1165-PK8",
    "category": "Gears, Chain & Belts",
    "description": "REV-41-1165-PK8 · $8.25 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-41-1165-pk8/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/229/2353/REV-41-1165-Photo5__96927.1654195209.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-41-1164",
    "name": "Polyurethane Round Belt - 6mm - 6ft",
    "sku": "REV-41-1164",
    "category": "Gears, Chain & Belts",
    "description": "REV-41-1164 · $9.25 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-41-1164/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/228/854/polycord__91088.1494520527.jpg?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-41-1163",
    "name": "Surgical Tubing - 3mm",
    "sku": "REV-41-1163",
    "category": "Materials & Consumables",
    "description": "REV-41-1163 · $7.75 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-41-1163/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/227/808/Surgical_Tubing_REV-41-1163-black_1__96733.1603466416.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-31-1155",
    "name": "Potentiometer",
    "sku": "REV-31-1155",
    "category": "Parts",
    "description": "REV-31-1155 · $15.25 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-31-1155/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/218/2710/REV-31-1155_Pot1__52143.1650558869.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-31-1153",
    "name": "REV Robotics Expansion Hub",
    "sku": "REV-31-1153",
    "category": "Electronics & Control",
    "description": "REV-31-1153 · $275.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-31-1153/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/216/2784/Expansion_Hub_One-noflag__63205.1650572103.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-11-1134",
    "name": "36in 2-Wire Jumper Cable",
    "sku": "REV-11-1134",
    "category": "Cables & Connectors",
    "description": "REV-11-1134 · $2.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-11-1134/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/211/2363/REV-11-1134_2-Wire-Jumper-Cable-2-Alicia-FINAL__78885.1636497194.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-11-1144",
    "name": "Servo Power Module",
    "sku": "REV-11-1144",
    "category": "Servos",
    "description": "REV-11-1144 · $57.50 $48.88 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-11-1144/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/209/2764/ServoPowerModuleAngled-800-Web__59220.1650570152.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-41-1065",
    "name": "40:1 Hex Gearbox & Pinion",
    "sku": "REV-41-1065",
    "category": "Gearboxes",
    "description": "REV-41-1065 · $17.00 $14.45 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-41-1065/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/208/2691/REV-41-1065-40-to-1-Hex-Gearbox--Pinion-NOFlag-FINAL__80541.1650555244.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-41-1368-pk10",
    "name": "Small Pulley Bearings - 10 Pack",
    "sku": "REV-41-1368-PK10",
    "category": "Gears, Chain & Belts",
    "description": "REV-41-1368-PK10 · $13.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-41-1368-pk10/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/205/751/REV-41-1368-1__56336.1472785907.JPG?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-41-1365",
    "name": "#25 Roller Chain - 10 ft",
    "sku": "REV-41-1365",
    "category": "Gears, Chain & Belts",
    "description": "REV-41-1365 · $19.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-41-1365/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/203/749/REV-41-1365-1__17582.1472785904.JPG?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-41-1366-pk5",
    "name": "#25 Connecting Links - 5 Pack",
    "sku": "REV-41-1366-PK5",
    "category": "Parts",
    "description": "REV-41-1366-PK5 · $6.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-41-1366-pk5/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/202/748/REV-41-1366-1__24852.1615482297.JPG?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-41-1119",
    "name": "5.5mm Nut Driver",
    "sku": "REV-41-1119",
    "category": "Hardware",
    "description": "REV-41-1119 · $8.25 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-41-1119/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/196/747/REV-41-1119-1__68915.1603466471.JPG?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-31-1302",
    "name": "12V Slim Battery",
    "sku": "REV-31-1302",
    "category": "Batteries & Power",
    "description": "REV-31-1302 · $60.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-31-1302/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/193/2367/REV-31-1302-12VSlimBattery-New-FINAL__87390.1636579008.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-41-1364-pk4",
    "name": "Servo Gear Adapter - 4 Pack",
    "sku": "REV-41-1364-PK4",
    "category": "Servo Accessories",
    "description": "REV-41-1364-PK4 · $6.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-41-1364-pk4/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/191/2491/REV-41-1364-render-downloadedfrombigcommerce-edit__22374.1640721917.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-41-1328-pk4",
    "name": "Servo Shaft Adapter - 4 Pack",
    "sku": "REV-41-1328-PK4",
    "category": "Servo Accessories",
    "description": "REV-41-1328-PK4 · $6.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-41-1328-pk4/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/171/2380/REV-41-1328-Servo-Shaft-Adapters-AliciaFINAL__94334.1714743859.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-41-1322-pk8",
    "name": "End Cap Bearing - 8 Pack",
    "sku": "REV-41-1322-PK8",
    "category": "Bearings",
    "description": "REV-41-1322-PK8 · $6.75 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-41-1322-pk8/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/166/2495/REV-41-1322-bigcommerce-edit__58291.1640724044.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:maxspline-shaft-bearing-blocks",
    "name": "MAXSpline Shaft Bearing Blocks",
    "sku": null,
    "category": "Bearings",
    "description": "$13.00 - $34.75 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/maxspline-shaft-bearing-blocks/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/818/3257/REV-21-0000-MAXSplineShaftBearingBlockSideMount-FamilyHero-FINAL__02108.1704464648.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-41-1291",
    "name": "HD Hex Motor No Gearbox",
    "sku": "REV-41-1291",
    "category": "Gearboxes",
    "description": "REV-41-1291 · $22.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/REV-41-1291/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/597/3613/HD_Hex_HERO_FINAL__95404.1761255494.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-11-1271",
    "name": "Through Bore Encoder V1",
    "sku": "REV-11-1271",
    "category": "Parts",
    "description": "REV-11-1271 · $48.00 $40.80 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-11-1271/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/404/1487/Through_Bore_Encoder_Both_Shots_Sml__30025.1574098624.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-49-1559-pk10",
    "name": "8mm x 12mm x 3.5mm Flanged Bearing - 10 Pack",
    "sku": "REV-49-1559-PK10",
    "category": "Bearings",
    "description": "REV-49-1559-PK10 · $18.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-49-1559-pk10/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/296/1055/REV-49-1559-1__67349.1618523296.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-41-1300",
    "name": "Core Hex Motor",
    "sku": "REV-41-1300",
    "category": "Motors",
    "description": "REV-41-1300 · $32.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-41-1300/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/195/2675/REV-41-1300_Core_Hex5_not_lm__05075.1661790332.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:m3-ball-joint-rod-ends",
    "name": "M3 Ball Joint Rod Ends",
    "sku": null,
    "category": "Hardware",
    "description": "$13.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/M3-Ball-Joint-Rod-Ends/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/716/2884/REV-49-0000-BallJointRodEnd-Hero-FINAL__03934.1654268765.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-45-1882",
    "name": "Allen Wrench Pack",
    "sku": "REV-45-1882",
    "category": "Tools",
    "description": "REV-45-1882 · $7.75 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-45-1882/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/593/1869/REV-45-1882-Allen-Wrench-Pack-FINAL__44020.1614353715.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-41-1615",
    "name": "UltraPlanetary Female 5mm Hex Output V2",
    "sku": "REV-41-1615",
    "category": "Gearboxes",
    "description": "REV-41-1615 · $18.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-41-1615/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/591/2053/REV-41-1615-UltraPlanetary-Female-5mm-Hex-Output-V2-Side-FINAL__04950.1620332336.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-29-1240-pk25",
    "name": "3/8in Split Lock Washer - 25 Pack",
    "sku": "REV-29-1240-PK25",
    "category": "Hardware",
    "description": "REV-29-1240-PK25 · $2.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-29-1240/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/326/1112/3-8_Split_Washer__82024.1603469861.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-29-1220-pk5",
    "name": "#10-32 1-1/2in Button-head Socket Cap Screw - 5 Pack",
    "sku": "REV-29-1220-PK5",
    "category": "Hardware",
    "description": "REV-29-1220-PK5 · $2.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-29-1220/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/324/1110/10-32_1.5_Button_Head_Screw__32294.1515219237.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-41-1558",
    "name": "Aluminum Servo Shaft Adapter",
    "sku": "REV-41-1558",
    "category": "Servo Accessories",
    "description": "REV-41-1558 · $8.75 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-41-1558/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/300/2057/REV-41-1558-Aluminum-Servo-Shaft-Adapter-2-FINAL__53014.1620421929.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-11-1292-pk2",
    "name": "4-Pin JST to PWM Sensor Adapter Cable - 2 Pack",
    "sku": "REV-11-1292-PK2",
    "category": "Electronics & Control",
    "description": "REV-11-1292-PK2 · $4.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-11-1292/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/291/1873/REV-11-1292-JST-PH-4-Pin-to-PWM-Connector-FINAL__60707.1614375085.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-11-1198",
    "name": "5V Addressable LED Strip - 1m",
    "sku": "REV-11-1198",
    "category": "Electronics & Control",
    "description": "REV-11-1198 · $26.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-11-1198/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/289/1133/5V_Addressable_LED_Strip__95511.1515854427.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-11-1197",
    "name": "12V RGB LED Strip - 5m",
    "sku": "REV-11-1197",
    "category": "Electronics & Control",
    "description": "REV-11-1197 · $28.75 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-11-1197/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/288/1134/12V_RGB_LED_Strip__79961.1515814180.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-31-1462",
    "name": "Magnetic Limit Switch",
    "sku": "REV-31-1462",
    "category": "Parts",
    "description": "REV-31-1462 · $17.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-31-1462/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/285/2690/Lone_Hall_Sensor__00715.1650555551.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-31-1108",
    "name": "SRS Programmer",
    "sku": "REV-31-1108",
    "category": "Electronics & Control",
    "description": "REV-31-1108 · $25.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-31-1108/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/116/634/REV-31-1108-1__84485.1603470088.JPG?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-41-1301",
    "name": "HD Hex Motor 40:1 Spur Gearbox",
    "sku": "REV-41-1301",
    "category": "Gearboxes",
    "description": "REV-41-1301 · $34.50 $29.33 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-41-1301/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/594/2931/Lone_HDHex-New_Sticker-noflag__98232.1659470612.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:15mm-extrusion-slot-cover-2m",
    "name": "15mm Extrusion Slot Cover - 2m",
    "sku": null,
    "category": "Structure",
    "description": "$5.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/15mm-extrusion-slot-cover/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/504/1388/15mm_Extrusion_Slot_Lifted_No_Colors__46166.1565909795.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-29-1241",
    "name": "Eye-to-Eye Turnbuckle",
    "sku": "REV-29-1241",
    "category": "Hardware",
    "description": "REV-29-1241 · $4.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-29-1241/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/329/1115/M4_Turnbuckle__46652.1515213147.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-21-1202-pk4",
    "name": "1in Extrusion Endcap Slide - 4 Pack",
    "sku": "REV-21-1202-PK4",
    "category": "Structure",
    "description": "REV-21-1202-PK4 · $6.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-21-1202/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/317/1085/REV-21-1202-1__81430.1513375618.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-15-1189",
    "name": "1in Linear Motion Kit",
    "sku": "REV-15-1189",
    "category": "Kits & Bundles",
    "description": "REV-15-1189 · $26.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-15-1189/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/214/1494/Linear_Motion_Kit__58341.1485794933.1280.1280__37765.1576102412.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-41-1620",
    "name": "UltraPlanetary 1/2in Hex Adapter",
    "sku": "REV-41-1620",
    "category": "Gearboxes",
    "description": "REV-41-1620 · $10.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-41-1620/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/568/1965/UltraPlanetary_Hex_Adapter-REV-41-1620-FINAL-01__79894.1616012970.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-25-1870",
    "name": "Through Bore Encoder Insert Pack",
    "sku": "REV-25-1870",
    "category": "Hardware",
    "description": "REV-25-1870 · $4.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/REV-25-1870/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/540/1633/Through_Bore_Encoder_Both_Shots__18509.1596657473.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-45-1831",
    "name": "15mm Linear Motion Kit V2 Hardware Pack",
    "sku": "REV-45-1831",
    "category": "Kits & Bundles",
    "description": "REV-45-1831 · $7.75 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-45-1831/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/524/1540/Hardware_Pack_Linear_Motion_V2_All_Items__59664.1578522113.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-41-1820",
    "name": "Aluminum Double Servo Arm",
    "sku": "REV-41-1820",
    "category": "Servo Accessories",
    "description": "REV-41-1820 · $7.75 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-41-1820/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/466/1500/Aluminum_Double_Servo_Arm_Hero__76461.1618523165.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-21-1029",
    "name": "Eccentric Bushing",
    "sku": "REV-21-1029",
    "category": "Bearings",
    "description": "REV-21-1029 · $5.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-21-1029/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/124/645/REV-21-1029-1__75506.1472438035.JPG?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-21-1032",
    "name": "Dual Bearing Plate",
    "sku": "REV-21-1032",
    "category": "Bearings",
    "description": "REV-21-1032 · $8.75 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-21-1032/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/123/1130/Dual_Bearing_Plate_Side__92012.1515803935.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-21-1030",
    "name": "Concentric Bushing",
    "sku": "REV-21-1030",
    "category": "Bearings",
    "description": "REV-21-1030 · $5.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-21-1030/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/121/640/REV-21-1030-1__69099.1497541532.JPG?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-11-1107",
    "name": "Analog Pressure Sensor",
    "sku": "REV-11-1107",
    "category": "Electronics & Control",
    "description": "REV-11-1107 · $39.42 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-11-1107/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/113/2759/PressureSensorWeb__26915.1650568869.jpg?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-41-1607",
    "name": "UltraPlanetary 550 Motor Plate",
    "sku": "REV-41-1607",
    "category": "Gearboxes",
    "description": "REV-41-1607 · $5.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-41-1607/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/516/1739/UltraPlanetary_550_Motor_Plate-FINAL-01__39064.1613072743.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-41-1503-pk8",
    "name": "22 Tooth Plastic Right Angle Rack Gear - 8 Pack",
    "sku": "REV-41-1503-PK8",
    "category": "Gears, Chain & Belts",
    "description": "REV-41-1503-PK8 · $11.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-41-1503/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/401/2370/REV-41-1503-22ToothPlasticRightAngleGear-AliciaFINAL__86975.1636583832.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-41-1267",
    "name": "90mm Grip Wheel",
    "sku": "REV-41-1267",
    "category": "Wheels",
    "description": "REV-41-1267 · $7.75 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-41-1267/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/344/1192/90mm_Grip_Wheel__30858.1533945208.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-41-1452-pk4",
    "name": "15mm Metal 12mm Ball Bearing Mount V2 - 4 Pack",
    "sku": "REV-41-1452-PK4",
    "category": "Bearings",
    "description": "REV-41-1452-PK4 · $6.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-41-1452-pk4/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/304/1071/REV-41-1452-1__96224.1513387775.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-41-1168",
    "name": "Replacement Gear Set for Smart Robot Servo",
    "sku": "REV-41-1168",
    "category": "Servo Accessories",
    "description": "REV-41-1168 · $13.00 $11.05 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-41-1168/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/215/1713/Servo_Gear_Replacemnt_Set_Original_Photo_Fixed_Up_By_Lauren__44535.1600983563.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-11-1118",
    "name": "MXP Extension Cable",
    "sku": "REV-11-1118",
    "category": "Cables & Connectors",
    "description": "REV-11-1118 · $17.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-11-1118/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/145/669/REV-11-1118-1__52108.1472438046.JPG?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-11-1113",
    "name": "Digit MXP Display",
    "sku": "REV-11-1113",
    "category": "Electronics & Control",
    "description": "REV-11-1113 · $23.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-11-1113/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/144/2671/REV-11-1113-DigitMXPDisplay-FINAL__07086.1650552873.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-62-1866",
    "name": "5.5mm WERA Nut Driver",
    "sku": "REV-62-1866",
    "category": "Hardware",
    "description": "REV-62-1866 · $12.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-62-1866/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/554/1648/5.5mm_WERA_Nut_Driver_REV-62-1866-FINAL-01__94554.1599885103.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-41-1833-pk2",
    "name": "Universal Hex Adapter V2 - 2 Pack",
    "sku": "REV-41-1833-PK2",
    "category": "Parts",
    "description": "REV-41-1833-PK2 · $8.25 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-41-1833/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/522/2386/REV-41-1833-Universial-Hex-Adapter-V2-AliciaFINAL__12775.1636670020.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-41-1719-pk2",
    "name": "Locking Motion Hub - 2 Pack",
    "sku": "REV-41-1719-PK2",
    "category": "Parts",
    "description": "REV-41-1719-PK2 · $5.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-41-1719/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/468/1492/Locking_Motion_Hub_Pair__72358.1615481582.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-21-1203-pk2",
    "name": "1in Inside Corner Bracket - 2 Pack",
    "sku": "REV-21-1203-PK2",
    "category": "Structure",
    "description": "REV-21-1203-PK2 · $12.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/REV-21-1203/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/318/1131/1_Inside_Corner_Bracket__04514.1515795724.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-41-1147-pk2",
    "name": "High Strength Hex Hub - 2 Pack",
    "sku": "REV-41-1147-PK2",
    "category": "Parts",
    "description": "REV-41-1147-PK2 · $6.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-41-1147-pk2/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/217/802/REV-41-1147_High_Strength_Hex_Adapter2__41896.1615482340.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:gt2-3mm-pitch-pulleys",
    "name": "GT2 3mm Pitch Pulleys",
    "sku": null,
    "category": "Gears, Chain & Belts",
    "description": "$2.50 - $7.75 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/GT2-3mm-Pitch-Pulleys/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/706/2907/REV-41-0000-GT2PulleySystem-Hero-FINAL__67825.1654809615.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-29-1223-pk25",
    "name": "#10-32 1/2in Flat-head Socket Cap Screw - 25 Pack",
    "sku": "REV-29-1223-PK25",
    "category": "Hardware",
    "description": "REV-29-1223-PK25 · $5.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-29-1223/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/320/1094/1-2_Flat-head_Socket_Cap_Screw_Lone__49661.1513383667.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-29-1016-pk100",
    "name": "#10-32 Low Profile Nylon Lock Nut - 100 Pack",
    "sku": "REV-29-1016-PK100",
    "category": "Hardware",
    "description": "REV-29-1016-PK100 · $4.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-29-1016/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/293/1050/REV-29-1016-1__51301.1603467943.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-11-1196",
    "name": "Blinkin LED Cable Adapter",
    "sku": "REV-11-1196",
    "category": "Electronics & Control",
    "description": "REV-11-1196 · $4.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-11-1196/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/287/1132/Blinkin_LED_Cable_Adapter__99274.1603470105.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-41-1702-pk4",
    "name": "Tensioning Bushing - 39mm - 4 Pack",
    "sku": "REV-41-1702-PK4",
    "category": "Bearings",
    "description": "REV-41-1702-PK4 · $6.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-41-1702/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/405/1472/Tensioning-Bushing-REV-41-1702__87580.1615481443.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:m3-standoffs",
    "name": "M3 Standoffs",
    "sku": null,
    "category": "Hardware",
    "description": "$3.00 - $12.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/M3-Standoffs/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/707/2862/REV-41-1489-M3_Standoff-Hero-FINAL__97606.1653061938.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-41-1716-pk4",
    "name": "10 Tooth Metal #25 Sprocket - 4 Pack",
    "sku": "REV-41-1716-PK4",
    "category": "Gears, Chain & Belts",
    "description": "REV-41-1716-PK4 · $12.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-41-1716/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/469/2197/REV-41-1716-10ToothMetal25Sprocket-45Degrees-FINAL__83271.1632951193.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-41-1528-pk20",
    "name": "5mm Hex to 8mm Round Bearing Insert - 20 Pack",
    "sku": "REV-41-1528-PK20",
    "category": "Bearings",
    "description": "REV-41-1528-PK20 · $11.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-41-1528-pk20/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/297/1057/REV-41-1528-1__88373.1614451258.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-41-1687-pk4",
    "name": "U Channel Endcap - 4 Pack",
    "sku": "REV-41-1687-PK4",
    "category": "Structure",
    "description": "REV-41-1687-PK4 · $21.75 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-41-1687/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/452/2184/REV-41-1687-UchannelEndCap-45DegreesFlat-FINAL__40212.1632940083.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:hd-hex-spacers",
    "name": "HD Hex Spacers",
    "sku": null,
    "category": "Hardware",
    "description": "$3.00 · REV Robotics Shop All (Firecrawl listing scrape, Oct 2026)",
    "productUrl": "https://www.revrobotics.com/HD-Hex-Spacers",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/400/3785/REV-41-1648-1667_HDHEXSpacers_FAMILY_FINAL__82930.1778188429.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:duo-l-beams",
    "name": "DUO L Beams",
    "sku": null,
    "category": "Structure",
    "description": "$2.50 - $15.25 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/DUO-L-Beams/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/705/2855/REV-41-0000-L_Beam-Hero-FINAL__69064.1652970646.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:duo-flat-beams",
    "name": "DUO Flat Beams",
    "sku": null,
    "category": "Structure",
    "description": "$2.50 - $9.75 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/DUO-Flat-Beams/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/704/2853/REV-41-1691-Flat-Beam-Hero-FINAL__29768.1652731218.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-41-1712-pk10",
    "name": "M3 x 10mm Nylon Patch Set Screw - 10 Pack",
    "sku": "REV-41-1712-PK10",
    "category": "Hardware",
    "description": "REV-41-1712-PK10 · $6.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-41-1712/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/402/1490/M3x10mm_Nylon_Patch_Screw_Hero__00175.1576015983.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:m3-hex-cap-screws",
    "name": "M3 Hex Cap Screws",
    "sku": null,
    "category": "Hardware",
    "description": "$10.50 - $18.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/M3-Hex-Cap-Screws/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/722/2894/M3x10mm_Hex_Cap_Screws_Pack_Photo_From_Bundle_Shot__18790.1614451259.1280.1280__98672.1654289750.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-21-1650",
    "name": "NEO Brushless Motor V1.1",
    "sku": "REV-21-1650",
    "category": "Motors",
    "description": "REV-21-1650 · $50.00 $42.50 · Out of stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-21-1650/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/752/3031/REV-21-1650-NEO1.1-Hero-FINAL__64905.1692730050.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-21-3008",
    "name": "3in MAXSwerve Module - Gear Ratio Upgrade Kit",
    "sku": "REV-21-3008",
    "category": "Drivetrain",
    "description": "REV-21-3008 · $58.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-21-3008/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/817/3258/REV-21-3008-3inMAXSwerveModule-GearRatioUpgradeKit-KitContents-FINAL__45111.1704464713.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-11-9008",
    "name": "MAXSpline Encoder",
    "sku": "REV-11-9008",
    "category": "Parts",
    "description": "REV-11-9008 · $80.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-11-9008/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/931/3687/REV-11-9008_MAXSplineThroughboreEncoder-Hero-FINAL__19116.1764989476.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:maxspline-shafts-47in",
    "name": "MAXSpline Shafts - 47in",
    "sku": null,
    "category": "Shafts & Axles",
    "description": "$12.00 - $20.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/MAXSpline-shafts-47in",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/932/3880/REV-21-2520-6520_MAXSplineShaft_Family_FINAL__35446.1791303305.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-77-3703",
    "name": "Curriculum - Intro to Robotics V2",
    "sku": "REV-77-3703",
    "category": "Education",
    "description": "REV-77-3703 · $299.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-77-3703/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/954/3764/Intro_to_Robotics_v3_Web__93045.1770917230.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-25-2741",
    "name": "MAX 180 Degree Gearbox",
    "sku": "REV-25-2741",
    "category": "Gearboxes",
    "description": "REV-25-2741 · $86.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-25-2741/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/814/3213/REV-25-2741-180Degree-OutputKit-Hero-FINAL__89740.1703881452.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-45-2041",
    "name": "EDU Kit V2",
    "sku": "REV-45-2041",
    "category": "Kits & Bundles",
    "description": "REV-45-2041 · $1,135.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-45-2041/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/590/1842/REV-45-2041-EDU_Kit_V2-FINAL__01041.1612558197.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-25-3239",
    "name": "#10-32 Hardware Bundle - Socket Head",
    "sku": "REV-25-3239",
    "category": "Kits & Bundles",
    "description": "REV-25-3239 · $216.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-25-3239/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/919/3611/ION-Bundles-12__04851.1761066243.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-25-3238",
    "name": "#10-32 Hardware Bundle - Button Head",
    "sku": "REV-25-3238",
    "category": "Kits & Bundles",
    "description": "REV-25-3238 · $216.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-25-3238/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/918/3609/ION-Bundles-11__15088.1761066210.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-25-3237",
    "name": "ION Hardware Accessory Bundle",
    "sku": "REV-25-3237",
    "category": "Kits & Bundles",
    "description": "REV-25-3237 · $315.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-25-3237/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/917/3763/ION-Bundles-ION-Hardware-Accessory-Bundle-1__50030.1770761045.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-25-3173",
    "name": "ION Power Bundle",
    "sku": "REV-25-3173",
    "category": "Kits & Bundles",
    "description": "REV-25-3173 · $594.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-25-3173/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/916/3605/ION-Bundles-09__39255.1761066102.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-25-3133",
    "name": "MAXTube Advanced Structure Bundle",
    "sku": "REV-25-3133",
    "category": "Structure",
    "description": "REV-25-3133 · $540.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-25-3133/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/915/3601/ION-Bundles-08__97712.1761065981.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-25-3132",
    "name": "MAXTube Classic Structure Bundle",
    "sku": "REV-25-3132",
    "category": "Structure",
    "description": "REV-25-3132 · $486.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-25-3132/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/912/3603/ION-Bundles-07__25295.1761066066.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-25-3267",
    "name": "Drivetrain Kit - West Coast",
    "sku": "REV-25-3267",
    "category": "Drivetrain",
    "description": "REV-25-3267 · $1,800.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-25-3267/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/847/3370/REV-25-3267-WestCoastDrivetrainKit-Hero-FINAL__98235.1732663481.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-25-3270",
    "name": "Drivetrain Kit - 3in MAXSwerve",
    "sku": "REV-25-3270",
    "category": "Drivetrain",
    "description": "REV-25-3270 · $2,400.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-25-3270/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/836/3385/REV-25-3270-3inMAXSwerveDrivetrainKit-Hero-FINAL__24842.1733173135.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-21-2099",
    "name": "2 Motor Gearbox - Through Bore",
    "sku": "REV-21-2099",
    "category": "Gearboxes",
    "description": "REV-21-2099 · $91.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-21-2099/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/743/3011/REV-21-2099-Gearbox-hero-FINAL__14235.1670962720.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-21-2190",
    "name": "2 Motor Drivetrain Gearbox - Through Bore",
    "sku": "REV-21-2190",
    "category": "Drivetrain",
    "description": "REV-21-2190 · $89.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-21-2190/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/736/3014/REV-21-2190-FRCDrivetrainGearbox-Iso-FINAL__64156.1670962718.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-21-2735",
    "name": "Linear Actuator - 12in Stroke",
    "sku": "REV-21-2735",
    "category": "Motors",
    "description": "REV-21-2735 · $240.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-21-2735/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/813/3208/REV-21-2735-LinearActuatorKit-12inStroke-Hero-FINAL__84279.1703774115.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-35-1906",
    "name": "Control & Power Bundle",
    "sku": "REV-35-1906",
    "category": "Kits & Bundles",
    "description": "REV-35-1906 · $750.00 · Out of stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-35-1906/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/553/3520/REV-35-1906-Control_and_Power_Bundle-_7-25-2025-FINAL__56259.1753718780.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-45-3529",
    "name": "FTC Starter Kit V3.1",
    "sku": "REV-45-3529",
    "category": "Kits & Bundles",
    "description": "REV-45-3529 · $695.00 · Out of stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-45-3529/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/830/3314/REV-45-3529-FTC_Starter_Kit_V3.1-FINAL_1__04896.1721829496.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:maxplanetary-system-kit",
    "name": "MAXPlanetary System Kit",
    "sku": null,
    "category": "Gearboxes",
    "description": "$36.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/maxplanetary-system-kit/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/626/2420/MaxPlanetary_alicia_FINAL__40789.1639427354.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-21-2129",
    "name": "MAXPlanetary 9:1 Cartridge",
    "sku": "REV-21-2129",
    "category": "Gearboxes",
    "description": "REV-21-2129 · $60.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-21-2129/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/816/3293/REV-21-2129-MAXPlanetary-Cartridge-9-Hero-FINAL__15756.1710776980.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-35-2709",
    "name": "DUO Control Bundle",
    "sku": "REV-35-2709",
    "category": "Kits & Bundles",
    "description": "REV-35-2709 · $650.00 · Out of stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-35-2709/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/782/3521/REV-35-2709-DUO-Control-Bundle-7-25-2024-FINAL__98914.1753718919.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-45-2708",
    "name": "DUO EDU Mechanical Kit",
    "sku": "REV-45-2708",
    "category": "Kits & Bundles",
    "description": "REV-45-2708 · $500.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-45-2708/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/781/3142/REV-45-2708-DUO-EDU-Mechanical-Kit-FINAL__12217.1690219433.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-21-2103",
    "name": "MAXPlanetary 5:1 Cartridge",
    "sku": "REV-21-2103",
    "category": "Gearboxes",
    "description": "REV-21-2103 · $32.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-21-2103/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/619/3295/REV-21-2103-MAXPlanetary-Cartridge-5-Hero-FINAL__75170.1710777022.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-21-2102",
    "name": "MAXPlanetary 4:1 Cartridge",
    "sku": "REV-21-2102",
    "category": "Gearboxes",
    "description": "REV-21-2102 · $32.00 · Out of stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-21-2102/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/618/3294/REV-21-2102-MAXPlanetary-Cartridge-4-Hero-FINAL__35074.1710778602.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-21-2101",
    "name": "MAXPlanetary 3:1 Cartridge",
    "sku": "REV-21-2101",
    "category": "Gearboxes",
    "description": "REV-21-2101 · $32.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-21-2101/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/617/3291/REV-21-2101-MAXPlanetary-Cartridge-3-Hero-FINAL__56429.1710776946.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-41-2080",
    "name": "Ultra 90 Degree Gearbox",
    "sku": "REV-41-2080",
    "category": "Gearboxes",
    "description": "REV-41-2080 · $45.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-41-2080/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/611/2269/REV-45-2080-Ultra90DegreeGearbox-BottomView-FINAL__83954.1638210302.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-45-2194",
    "name": "EDU Kit V2 to Starter Kit V3.1 Upgrade",
    "sku": "REV-45-2194",
    "category": "Kits & Bundles",
    "description": "REV-45-2194 · $450.00 · Out of stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-45-2194/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/850/3501/REV-45-2194-EDU_Kit_V2_to_Starter_Kit_V3_Upgrade-V3.1-EDITED-6-25-25_Michaela__76273.1750887285.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-45-1896",
    "name": "C Channel Bundle",
    "sku": "REV-45-1896",
    "category": "Structure",
    "description": "REV-45-1896 · $229.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-45-1896/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/546/1688/C_Channel_Bundle_V1__40251.1618524296.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-45-1895",
    "name": "U Channel Bundle",
    "sku": "REV-45-1895",
    "category": "Structure",
    "description": "REV-45-1895 · $229.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-45-1895/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/545/1663/U_Channel_Bundle-FINAL-01__86858.1618524447.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-45-1892",
    "name": "Servo Bundle",
    "sku": "REV-45-1892",
    "category": "Servo Accessories",
    "description": "REV-45-1892 · $327.50 $278.38 · Out of stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-45-1892/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/544/1702/Servo_Bundle_V3__62904.1603469793.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:20dp-gears-maxspline",
    "name": "20DP Gears - MAXSpline",
    "sku": null,
    "category": "Gears, Chain & Belts",
    "description": "$13.00 - $38.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/20DP-Gears-Maxspline/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/855/3396/20DP-Gears-MAXSpline-Hero-FINAL__06440.1733360018.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-31-2983",
    "name": "REV USB PS4 Compatible Gamepad",
    "sku": "REV-31-2983",
    "category": "Electronics & Control",
    "description": "REV-31-2983 · $26.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-31-2983/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/829/3518/REV-31-2983-REVUSBPS4CompatibleGamepad-Hero-FINAL-new__77925.1753717119.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:3-8in-nut-strips",
    "name": "3/8in Nut Strips",
    "sku": null,
    "category": "Hardware",
    "description": "$5.50 - $19.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/3-8in-nut-strips/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/821/3590/3-8nutstrip_FAMILY_FINAL__50961.1760542325.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:20dp-gears-1-2in-hex",
    "name": "20DP Gears - 1/2in Hex",
    "sku": null,
    "category": "Gears, Chain & Belts",
    "description": "$11.00 - $28.25 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/20DP-Gears-0.5-Hex/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/679/3397/20DP-Gears-0.5in-Hex-Hero-FINAL__99081.1733360048.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:ion-25-sprockets",
    "name": "ION #25 Sprockets",
    "sku": null,
    "category": "Gears, Chain & Belts",
    "description": "$9.75 - $39.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/ION-25-Sprockets/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/659/3405/25_Sprockets-Family-Hero-FINAL__68666.1733438402.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-21-2510",
    "name": "Dead Axle Tube - 3/4in - 36in",
    "sku": "REV-21-2510",
    "category": "Shafts & Axles",
    "description": "REV-21-2510 · $14.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-21-2510/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/701/2825/REV-21-2510-DeadAxleTube-FINAL__71747.1692730082.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-21-2385-pk2",
    "name": "3/4in Needle Bearing Carrier - 2 Pack",
    "sku": "REV-21-2385-PK2",
    "category": "Bearings",
    "description": "REV-21-2385-PK2 · $4.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-21-2385/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/700/2826/REV-21-2385-NeedleBearingCarrierFINAL__74021.1651267700.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:maxhubs",
    "name": "MAXHubs",
    "sku": null,
    "category": "Parts",
    "description": "$3.25 - $7.25 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/MAXHubs/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/696/2643/Untitled-4__08050.1692730533.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:max-pattern-plates",
    "name": "MAX Pattern Plates",
    "sku": null,
    "category": "Structure",
    "description": "$2.75 - $16.25 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/MAX-Pattern-Plates/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/695/2666/Untitled-11__24295.1650342342.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-21-2395-pk2",
    "name": "1in Pivot Joint - 2 Pack",
    "sku": "REV-21-2395-PK2",
    "category": "Parts",
    "description": "REV-21-2395-PK2 · $7.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-21-2395/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/689/2642/Untitled-2__96299.1650292781.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:maxspline-brackets",
    "name": "MAXSpline Brackets",
    "sku": null,
    "category": "Structure",
    "description": "$2.75 - $5.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/MAXSpline-Brackets/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/684/2941/REV-21-2350-2353-MAXSplineBracket-Hero-FINAL__57139.1660315921.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:1in-brackets",
    "name": "1in Brackets",
    "sku": null,
    "category": "Structure",
    "description": "$3.50 - $11.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/1in-Brackets/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/683/2841/1in-Brackets-Hero-Final__08533.1651685588.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:10-32-standoffs-3-8in-hex",
    "name": "#10-32 Standoffs - 3/8in Hex",
    "sku": null,
    "category": "Hardware",
    "description": "$6.25 - $15.25 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/10-32-Standoffs/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/680/2943/REV-21-2061-2071-10-32Standoffs-Hero-FINAL__93195.1660580019.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:ratio-plates",
    "name": "Ratio Plates",
    "sku": null,
    "category": "Structure",
    "description": "$8.75 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/ratio-plates/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/676/3009/REV-21-2567-2576-RatioPlates-Hero-FINAL__06234.1666892727.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:1-2in-rounded-hex-shafts",
    "name": "1/2in Rounded Hex Shafts",
    "sku": null,
    "category": "Shafts & Axles",
    "description": "$3.25 - $27.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/.5in-Rounded-Hex-Shafts/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/675/2948/REV-21-0000-2809-2823-0.5inRoundedHexShaft-FamilyHero-FINAL__95578.1660668305.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:10-spacers",
    "name": "#10 Spacers",
    "sku": null,
    "category": "Hardware",
    "description": "$1.50 - $5.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/10-spacers/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/672/2836/Untitled-20__68385.1651590731.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:ion-grip-wheels",
    "name": "ION Grip Wheels",
    "sku": null,
    "category": "Wheels",
    "description": "$6.50 - $17.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/ION-Grip-Wheels/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/667/3305/REV-21-2400-GripWheel-FamilyHero-May2024-FINAL__11415.1716577940.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:ion-traction-wheels",
    "name": "ION Traction Wheels",
    "sku": null,
    "category": "Wheels",
    "description": "$6.50 - $18.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/ION-Traction-Wheels/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/666/2646/Untitled-7__28355.1650296037.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:ion-omni-wheels",
    "name": "ION Omni Wheels",
    "sku": null,
    "category": "Wheels",
    "description": "$12.00 - $30.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/ION-Omni-Wheels/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/665/2644/Untitled-5__05138.1650294626.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:ion-compliant-wheels",
    "name": "ION Compliant Wheels",
    "sku": null,
    "category": "Wheels",
    "description": "$6.50 - $30.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/ION-Compliant-Wheels/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/664/2645/Untitled-6__21982.1650295805.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-21-2547-pk4",
    "name": "MAXSpline Spacer with MAX Pattern - 1/4in - 4 Pack",
    "sku": "REV-21-2547-PK4",
    "category": "Hardware",
    "description": "REV-21-2547-PK4 · $5.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-21-2547/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/662/2613/REV-21-2547-MAXSplineSpacer-MaxPattern-Front-FINAL_1__50566.1649981328.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:1-2in-hex-shaft-spacers",
    "name": "1/2in Hex Shaft Spacers",
    "sku": null,
    "category": "Shafts & Axles",
    "description": "$2.75 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/.5in-Hex-Shaft-Spacers/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/661/2947/REV-21-0000-2003-2009-ShaftSpacer0.5inHex-FamilyHero-FINAL__46649.1660667109.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:maxspline-spacers",
    "name": "MAXSpline Spacers",
    "sku": null,
    "category": "Hardware",
    "description": "$4.00 - $5.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/MAXSpline-Spacers/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/660/2813/Untitled-17__42962.1651257163.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-11-1850",
    "name": "Power Distribution Hub",
    "sku": "REV-11-1850",
    "category": "Electronics & Control",
    "description": "REV-11-1850 · $250.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-11-1850/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/602/3245/REV-11-1850-Power-Distribution-Hub-Hero-FINAL__29576.1704386743.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-11-1956",
    "name": "Mini Power Module",
    "sku": "REV-11-1956",
    "category": "Electronics & Control",
    "description": "REV-11-1956 · $38.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-11-1956/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/650/3253/REV-11-1956-MiniPowerModule-Hero-FINAL__91572.1704391159.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-11-1852",
    "name": "Pneumatic Hub",
    "sku": "REV-11-1852",
    "category": "Electronics & Control",
    "description": "REV-11-1852 · $90.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-11-1852/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/600/2510/REV-11-1852-PH-Hero-FINAL__53879.1641407488.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-41-1683",
    "name": "5mm Hex Bearing Block",
    "sku": "REV-41-1683",
    "category": "Bearings",
    "description": "REV-41-1683 · $4.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-41-1683/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/467/1499/5mm_Hex_Bearing_Block_Side_Hero__99071.1614450895.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-21-3004",
    "name": "3in MAXSwerve Wheel V2.0 - Plastic",
    "sku": "REV-21-3004",
    "category": "Drivetrain",
    "description": "REV-21-3004 · $5.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-21-3004/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/803/3182/REV-21-3004-3inMAXSwerveWheel2.0--Plastic-Iso-FINAL__39287.1699482387.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-41-1600",
    "name": "UltraPlanetary Gearbox Kit & HD Hex Motor",
    "sku": "REV-41-1600",
    "category": "Gearboxes",
    "description": "REV-41-1600 · $50.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-41-1600/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/479/2739/Ultraplanetary-noflag-FINAL__33728.1650563601.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-31-1595",
    "name": "Control Hub",
    "sku": "REV-31-1595",
    "category": "Electronics & Control",
    "description": "REV-31-1595 · $375.00 · Out of stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-31-1595/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/391/2736/IMG_20170502_154043_not_lm__25913.1650563042.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:shaft-collars",
    "name": "Shaft Collars",
    "sku": null,
    "category": "Hardware",
    "description": "$9.75 · REV Robotics Shop All (Firecrawl listing scrape, Oct 2026)",
    "productUrl": "https://www.revrobotics.com/shaft-collars",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/977/3883/REV-41-1327-1629_ShaftCollarFamily_FINAL_v1__46328.1791304665.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:15t-spline-quality-assurance-set",
    "name": "15T Spline Quality Assurance Set",
    "sku": null,
    "category": "Parts",
    "description": "$180.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/15T-Spline-QA-Set/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/975/3877/8__81486.1787867973.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:max-90-degree-gearbox-spare-parts",
    "name": "MAX 90 Degree Gearbox Spare Parts",
    "sku": null,
    "category": "Gearboxes",
    "description": "$8.00 - $15.60 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/MAX-90-Gearbox-Spare-Parts",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/974/3855/REV_21-2120_MAX90DegreeGearbox_ExtraParts_Edited-FINAL__27940.1785261268.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:polycarbonate-sheets",
    "name": "Polycarbonate Sheets",
    "sku": null,
    "category": "Materials & Consumables",
    "description": "$11.00 - $75.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/Polycarbonate-Sheets/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/972/3846/REV-41-7357_PolycardGrid_Family_Edited-Final__84564.1782404846.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:jst-joiner-boards",
    "name": "JST Joiner Boards",
    "sku": null,
    "category": "Cables & Connectors",
    "description": "$6.00 - $9.75 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/JST-Joiner-Boards/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/971/3831/REV-11-1277_JSTJoinerBoards_FAMILY_FINAL__44024.1778868134.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:usb-a-to-usb-c-2-0-cables",
    "name": "USB-A to USB-C 2.0 Cables",
    "sku": null,
    "category": "Cables & Connectors",
    "description": "$10.50 - $11.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/USB-A-to-USB-C-Cables/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/969/3854/REV-11-1232_USB-C-Cables_FAMILY_FINAL_1__52275.1785187365.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:uhmwpe-cords",
    "name": "UHMWPE Cords",
    "sku": null,
    "category": "Parts",
    "description": "$7.75 - $13.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/UHMWPE-Cords/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/968/3814/REV-41-1162-1244_UHMWPECords_FAMILY_FINAL__45422.1778771472.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:xt30-adapters",
    "name": "XT30 Adapters",
    "sku": null,
    "category": "Cables & Connectors",
    "description": "$5.50 - $13.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/XT30-adapters",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/967/3813/REV-31-1382-85_XT30Adapters_FAMILY_FINAL__91829.1778696455.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:m3-nuts",
    "name": "M3 Nuts",
    "sku": null,
    "category": "Hardware",
    "description": "$6.00 - $8.75 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/M3-Nuts/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/966/3808/REV-41-1126-1361_M3Nuts_FAMILY_FINAL__12437.1778681422.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:5-5mm-wrenches",
    "name": "5.5mm Wrenches",
    "sku": null,
    "category": "Tools",
    "description": "$11.00 - $14.75 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/5.5mm-Wrenches",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/965/3807/REV-49-1711-1374_Wrenches_FAMILY_FINAL__94587.1778602932.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:12v-slim-battery-accessories",
    "name": "12V Slim Battery Accessories",
    "sku": null,
    "category": "Batteries & Power",
    "description": "$6.00 - $39.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/12V-Slim-Battery-Accessories/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/964/3803/REV-31-1299_BatteryAccessories_FAMILY_FINAL__46053.1778539185.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:encoder-adapters",
    "name": "Encoder Adapters",
    "sku": null,
    "category": "Parts",
    "description": "$11.00 - $12.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/Encoder-Adapters/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/963/3799/REV-11-1881_EncoderAdapters_FAMILY_FINAL__12131.1778274004.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:pwm-cables",
    "name": "PWM Cables",
    "sku": null,
    "category": "Cables & Connectors",
    "description": "$7.75 - $12.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/PWM-Cables/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/962/3832/REV-11-1130-31-1817_PWMCables_FAMILY_FINAL_v2__75672.1779120505.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:replacement-gear-set-for-smart-robot-servo-v2",
    "name": "Replacement Gear Set for Smart Robot Servo V2",
    "sku": null,
    "category": "Servo Accessories",
    "description": "$13.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/Replacement-Gear-Set-for-Smart-Robot-Servo-V2",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/961/3776/REV-41-3337_ServoGearReplacement_FINAL__28411.1776450062.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:easyswerve-spare-parts",
    "name": "EasySwerve Spare Parts",
    "sku": null,
    "category": "Drivetrain",
    "description": "$6.00 - $33.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/EasySwerve-spare-parts",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/960/3871/REV-21-3006_EasySwerve_ExtraParts_Family_Edited_FINAL_1__51843.1785421612.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-25-3389",
    "name": "Drivetrain Kit - 4in EasySwerve - NEO Vortex",
    "sku": "REV-25-3389",
    "category": "Drivetrain",
    "description": "REV-25-3389 · $2,350.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-25-3389/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/959/3774/Drivetrain-Kit---4in-EasySwerve---NEO-Vortex__25791.1775767881.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-25-3388",
    "name": "Drivetrain Kit - 4in EasySwerve - NEO 2.0",
    "sku": "REV-25-3388",
    "category": "Parts",
    "description": "REV-25-3388 · $2,000.00 · REV Robotics Shop All (Firecrawl listing scrape, Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-25-3388/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/958/3773/Drivetrain-Kit---4in-EasySwerve---NEO-2.0__64470.1775767863.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-25-3346",
    "name": "ION Bearing Bundle",
    "sku": "REV-25-3346",
    "category": "Bearings",
    "description": "REV-25-3346 · $285.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-25-3346/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/957/3767/REV-25-3346_ION_Bearings_FINAL-1__64135.1770996299.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-21-2147",
    "name": "MAXPlanetary NEO 2.0 Input Kit",
    "sku": "REV-21-2147",
    "category": "Gearboxes",
    "description": "REV-21-2147 · $15.25 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-21-2147/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/953/3739/REV-21-2147_MAXPlanetary_NEO2.0_InputKit_Final__89588.1767908707.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:ion-hub-adapters",
    "name": "ION Hub Adapters",
    "sku": null,
    "category": "Parts",
    "description": "$3.00 - $5.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/ION-Hub-Adapters",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/951/3769/REV-21-6535-37_HUBAdapter_Family_FINAL__50421.1774462876.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:ion-motor-mounting-blocks",
    "name": "ION Motor Mounting Blocks",
    "sku": null,
    "category": "Motors",
    "description": "$32.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/ION-Motor-Mounting-Blocks",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/950/3726/IONMotorMountingBlocks_FAMILY_FINAL__32008.1765819991.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-11-8020",
    "name": "Molex Microfit+ Power and CAN Cable - 6in",
    "sku": "REV-11-8020",
    "category": "Cables & Connectors",
    "description": "REV-11-8020 · $6.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-11-8020/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/949/3722/REV-11-8020_MAXSplineEncoderCable_Hero-FINAL__85720.1765398932.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-21-3293-pk2",
    "name": "1in Basic Corner Bracket - 2 Pack",
    "sku": "REV-21-3293-PK2",
    "category": "Structure",
    "description": "REV-21-3293-PK2 · $8.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-21-3293-pk2/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/947/3656/REV-21-3293_basiccornerbracket_HERO_FINAL_1__52828.1764893667.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-21-3291-pk2",
    "name": "1in Angled Corner Bracket - 2 Pack",
    "sku": "REV-21-3291-PK2",
    "category": "Electronics & Control",
    "description": "REV-21-3291-PK2 · $8.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-21-3291-pk2/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/946/3642/REV-21-3291_angledcornerbracket_HERO_FINAL__58306.1764890244.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-21-6532-pk2",
    "name": "Locking Shaft Collar - MAXSpline - 2 Pack",
    "sku": "REV-21-6532-PK2",
    "category": "Shafts & Axles",
    "description": "REV-21-6532-PK2 · $10.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-21-6532-pk2/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/945/3640/REV-21-6532_H_FINAL__17805.1764881379.JPG?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-21-6530",
    "name": "Locking MAXHub - 1/2in Hex Kit",
    "sku": "REV-21-6530",
    "category": "Kits & Bundles",
    "description": "REV-21-6530 · $8.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-21-6530/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/944/3731/REV-21-6530_H_FINALv2__88429.1767739958.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-21-4016-pk2",
    "name": "Adjustable Tube Mount - 2 Pack",
    "sku": "REV-21-4016-PK2",
    "category": "Structure",
    "description": "REV-21-4016-PK2 · $10.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-21-4016-pk2/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/943/3664/REV-21-4016_HERO_FINAL__15286.1764956031.jpg?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-11-3324",
    "name": "CAN Terminator Pack",
    "sku": "REV-11-3324",
    "category": "Cables & Connectors",
    "description": "REV-11-3324 · $7.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-11-3324/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/941/3673/REV-11-3324_TOP_FINAL__90391.1764969953.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:ion-conveyor-brush-system",
    "name": "ION Conveyor Brush System",
    "sku": null,
    "category": "Parts",
    "description": "$12.00 - $24.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/ion-conveyor-brush-system",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/940/3695/ConveyorBrushSystem_FAMILYFINAL__25930.1764996098.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:ion-round-belt-system",
    "name": "ION Round Belt System",
    "sku": null,
    "category": "Gears, Chain & Belts",
    "description": "$6.00 - $30.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/ion-round-belt-system",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/939/3670/RoundBeltSystem_Family_FINAL__29622.1764963913.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-21-4483-pk50",
    "name": "8mm Shaft Spacer - 1/16in - Plain - 50 Pack",
    "sku": "REV-21-4483-PK50",
    "category": "Shafts & Axles",
    "description": "REV-21-4483-PK50 · $9.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-21-4483-pk50/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/938/3718/REV-21-4483-PK50_HERO_FINAL__25966.1765308555.jpg?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-21-3630",
    "name": "MAXPlanetary MAXSpline Output Coupler",
    "sku": "REV-21-3630",
    "category": "Gearboxes",
    "description": "REV-21-3630 · $22.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-21-3630/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/937/3734/REV-21-3630_MAXPlanetaryOutput_Hero_FINAL__94405.1767812770.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-11-1287",
    "name": "NEO 2.0 Sensor Cable",
    "sku": "REV-11-1287",
    "category": "Electronics & Control",
    "description": "REV-11-1287 · $5.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-11-1287/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/934/3713/REV-11-1287_HERO_FINAL__59132.1765297434.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:ion-cone-wheels",
    "name": "ION Cone Wheels",
    "sku": null,
    "category": "Wheels",
    "description": "$6.00 - $8.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/ION-cone-wheels",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/933/3645/REV-21-6563-64-50_ConeWheel-2to3in_FAMILY-FINAL__83662.1764891648.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-21-4419-pk8",
    "name": "4in Spiky Wheel - Tread - 8 Pack",
    "sku": "REV-21-4419-PK8",
    "category": "Wheels",
    "description": "REV-21-4419-PK8 · $32.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-21-4419-pk8/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/930/3719/REV-21-4419_HERO_FINAL_1__78617.1765311318.jpg?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-21-4418",
    "name": "4in Spiky Wheel - Aluminum Hub",
    "sku": "REV-21-4418",
    "category": "Wheels",
    "description": "REV-21-4418 · $30.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-21-4418/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/929/3714/REV-21-4418_4inSpikyWheel_Hero_EDITED_1__89526.1765303542.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:20dp-gear-15t-spline",
    "name": "20DP Gear - 15T Spline",
    "sku": null,
    "category": "Gears, Chain & Belts",
    "description": "$12.00 - $14.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/20DP-Gears-15T-Spline",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/928/3634/20DPGears-15TSpline_FAMILY_FINAL__97556.1764103569.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-21-3640-pk10",
    "name": "MAXSpline Grommet - 10 Pack",
    "sku": "REV-21-3640-PK10",
    "category": "Hardware",
    "description": "REV-21-3640-PK10 · $10.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-21-3640-pk10/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/927/3622/grommet_hero_FINAL__63483.1763742071.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-25-3171",
    "name": "4in Spiky Wheel - Hub and Tread Bundle",
    "sku": "REV-25-3171",
    "category": "Wheels",
    "description": "REV-25-3171 · $152.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-25-3171/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/926/3684/REV-25-3171_HERO_FINAL__89903.1764987931.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-21-4484",
    "name": "15T Spline to 1/2in Hex Adapter",
    "sku": "REV-21-4484",
    "category": "Parts",
    "description": "REV-21-4484 · $11.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-21-4484/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/925/3626/REV-21-4484_HERO_FINAL__96983.1763747233.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-41-6457",
    "name": "15T Spline Shaft - 480mm",
    "sku": "REV-41-6457",
    "category": "Shafts & Axles",
    "description": "REV-41-6457 · $16.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-41-6457/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/924/3631/15Tsplineshaft480_HERO_FINAL__08003.1763759814.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-21-2140",
    "name": "MAXPlanetary 2:1 Cartridge",
    "sku": "REV-21-2140",
    "category": "Gearboxes",
    "description": "REV-21-2140 · $45.00 · Out of stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-21-2140/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/923/3759/REV-21-2140-MAXPlanetary-Cartridge-2-Hero-FINAL__41106.1770227134.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-20-2051-pk2",
    "name": "Elevator Bearing Block - 2 Pack",
    "sku": "REV-20-2051-PK2",
    "category": "Bearings",
    "description": "REV-20-2051-PK2 · $18.50 $15.73 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-20-2051-pk2/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/921/3617/1200_source_1734473179__18289.1761848002.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-41-2719-pk2",
    "name": "Helical 550 Motor Pinion Gear - 12 Tooth - 2 Pack",
    "sku": "REV-41-2719-PK2",
    "category": "Motors",
    "description": "REV-41-2719-PK2 · $7.00 $5.95 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-41-2719-pk2/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/920/3615/2401_source_1739482659__11750.1761837409.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-11-3174",
    "name": "Through Bore Encoder V2",
    "sku": "REV-11-3174",
    "category": "Parts",
    "description": "REV-11-3174 · $48.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-11-3174/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/910/3574/REV-11-3174-ThroughBoreEncoderV2_HERO_FINAL__64112.1763159842.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:duo-metal-25-sprockets",
    "name": "DUO Metal #25 Sprockets",
    "sku": null,
    "category": "Gears, Chain & Belts",
    "description": "$5.00 - $12.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/DUO-25-metal-sprockets/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/909/3568/DUO-Metal-25-Sprockets_Family__01893.1758909588.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:15mm-extrusions",
    "name": "15mm Extrusions",
    "sku": null,
    "category": "Structure",
    "description": "$6.00 - $29.75 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/15mm-extrusions/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/908/3593/15mmExtrusions_FAMILY_FINAL__33113.1760640309.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:45mm-u-channels",
    "name": "45mm U Channels",
    "sku": null,
    "category": "Structure",
    "description": "$2.50 - $44.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/45mm-u-channels/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/907/3583/45mmUChannels_FAMILY_FINAL__53023.1760541697.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:45mm-x-15mm-c-channels",
    "name": "45mm x 15mm C Channels",
    "sku": null,
    "category": "Structure",
    "description": "$4.50 - $31.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/45mm-x-15mm-C-Channels/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/906/3584/45mmx15mmC-Channels_FAMILY_FINAL__37329.1760541787.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:ultrausb-hub-and-cables",
    "name": "UltraUSB Hub and Cables",
    "sku": null,
    "category": "Electronics & Control",
    "description": "$4.00 - $25.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/UltraUSB-Hub-and-Cables/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/905/3545/Ultra_USB_Hub_Hero__29396.1790011784.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:jst-ph-6-pin-extension-cables",
    "name": "JST PH 6-pin Extension Cables",
    "sku": null,
    "category": "Cables & Connectors",
    "description": "$4.50 - $17.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/jst-ph-6-pin-extension-cables/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/904/3577/JST-PH6-pinExtensionCables_FAMILY_FINAL__67929.1760538618.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:45mm-flat-plates",
    "name": "45mm Flat Plates",
    "sku": null,
    "category": "Structure",
    "description": "$2.50 - $12.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/45mm-flat-plates/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/903/3592/45mmFlatPlates_FAMILY_FINAL__93997.1760640161.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:15mm-corner-brackets",
    "name": "15mm Corner Brackets",
    "sku": null,
    "category": "Structure",
    "description": "$6.00 - $12.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/15mm-corner-brackets/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/902/3566/15mm_Corner_Brackets_Family__38336.1758909388.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:ato-auto-resetting-breakers",
    "name": "ATO Auto-resetting Breakers",
    "sku": null,
    "category": "Batteries & Power",
    "description": "$26.00 - $30.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/auto-resetting-breakers/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/901/3565/ATO-Auto-resetting-Breaker-10-40A_FAMILY__80436.1758909235.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:15mm-pillow-blocks",
    "name": "15mm Pillow Blocks",
    "sku": null,
    "category": "Bearings",
    "description": "$5.00 - $7.75 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/15mm-Pillow-Blocks/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/900/3585/15mmPillowBlocks_FAMILY_FINAL__66342.1760541910.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:10-32-button-head-socket-cap-screws-100-pack",
    "name": "#10-32 Button-head Socket Cap Screws - 100 Pack",
    "sku": null,
    "category": "Hardware",
    "description": "$9.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/10-32-Button-head-socket-cap-screws/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/898/3525/REV-29-1222-PK100_Picture__31818.1756416381.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-41-3690",
    "name": "2025 FIRST Global Competition Kit",
    "sku": "REV-41-3690",
    "category": "Kits & Bundles",
    "description": "REV-41-3690 · $2,800.00 · Out of stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-41-3690/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/895/3522/First_Global_Kit_Contents_Vary__02423.1744212531__98176.1755892428.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:smart-robot-servos-v2",
    "name": "Smart Robot Servos V2",
    "sku": null,
    "category": "Servos",
    "description": "$32.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/Smart-servo-v2",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/894/3504/SRSV2-Family__93430.1752679900.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-15-2993",
    "name": "3in MAXSwerve Motor & SPARK Flex Bundle",
    "sku": "REV-15-2993",
    "category": "Drivetrain",
    "description": "REV-15-2993 · $400.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-15-2993/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/890/3483/REV-15-2993-3in-MAXSwerve_Motor__SPARK_Flex_Bundle-FINAL__28289.1740531809.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-21-2907",
    "name": "8mm Keyed Shaft Retaining Hardware Pack",
    "sku": "REV-21-2907",
    "category": "Shafts & Axles",
    "description": "REV-21-2907 · $2.25 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-21-2907/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/888/3481/REV-21-2907-8mm-Keyed-Shaft-Retaining-Hardware-Pack-FINAL__52949.1739478104.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-21-3535-pk2",
    "name": "MAXLift #25 Chain Attachment Plate - 2 Pack",
    "sku": "REV-21-3535-PK2",
    "category": "Gears, Chain & Belts",
    "description": "REV-21-3535-PK2 · $13.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-21-3535/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/876/3471/REV-21-3535-MAXLift-_25-Chain-Attachment-Plate-TOP__25601.1736275736.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-21-3009",
    "name": "3in MAXSwerve Module – 15T Spline Input Kit",
    "sku": "REV-21-3009",
    "category": "Drivetrain",
    "description": "REV-21-3009 · $43.25 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-21-3009/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/875/3463/REV-21-3009-3inMAXSwerveModuleKrakenInputKit-KitContents-FINAL__03875.1734562923.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-21-2139",
    "name": "MAXPlanetary Kraken X44 & Minion Input Kit",
    "sku": "REV-21-2139",
    "category": "Gearboxes",
    "description": "REV-21-2139 · $16.25 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-21-2139/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/874/3484/REV-21-2139-MAXPlanetary-Kraken-X44--Minion-Input-Kit-FINAL__08844.1740591116.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:maxlift-bearing-blocks",
    "name": "MAXLift Bearing Blocks",
    "sku": null,
    "category": "Bearings",
    "description": "$21.75 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/MAXLift-Bearing-Blocks/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/873/3580/REV-21-2600-MAXLiftBearingBlocks-FamilyHero-FINAL__21159.1760539077.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:gt2-3mm-pitch-belts",
    "name": "GT2 3mm Pitch Belts",
    "sku": null,
    "category": "Gears, Chain & Belts",
    "description": "$5.00 - $12.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/GT2-3mm-Pitch-Belts/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/872/3434/GT2-Belts_800__39947.1565910055.1280.1280__44350.1733765868.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:ion-bearings",
    "name": "ION Bearings",
    "sku": null,
    "category": "Bearings",
    "description": "$5.00 - $13.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/ION-Bearings/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/871/3433/ION_Bearings-Family-Hero-FINAL__10655.1733763769.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:10-32-shaft-end-screws",
    "name": "#10-32 Shaft End Screws",
    "sku": null,
    "category": "Shafts & Axles",
    "description": "$13.00 - $17.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/10-32-Shaft-End-Screws/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/870/3444/REV-21-3700-ShaftEndScrewV2-FamilyHero-FINAL__98164.1734046171.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-25-3101",
    "name": "3in MAXSwerve Spiky Wheel - Hub and Tread Bundle",
    "sku": "REV-25-3101",
    "category": "Drivetrain",
    "description": "REV-25-3101 · $100.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-25-3101/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/869/3487/MAXSwerve_Spiky_Wheel-Hero-Final__41754.1743462229.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:ion-motor-brackets",
    "name": "ION Motor Brackets",
    "sku": null,
    "category": "Motors",
    "description": "$4.50 - $11.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/ION-Motor-Brackets/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/868/3454/ION_Motor_Brackets-Family-Hero-FINAL__60886.1734558475.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:ion-35-sprockets",
    "name": "ION #35 Sprockets",
    "sku": null,
    "category": "Gears, Chain & Belts",
    "description": "$11.00 - $43.25 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/ION-35-Sprockets/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/867/3435/REV-21-3706-3731-ION35Sprockets-FamilyHero-FINAL__40419.1733848051.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-21-3093",
    "name": "3in MAXSwerve Spiky Wheel - Aluminum Hub",
    "sku": "REV-21-3093",
    "category": "Drivetrain",
    "description": "REV-21-3093 · $21.75 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-21-3093/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/866/3438/REV-21-3093-3inMAXSwerveSpikyWheel-AluminumHub-Hero-FINAL__57979.1733951717.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-21-3094-pk8",
    "name": "3in MAXSwerve Spiky Wheel - Tread - 8 Pack",
    "sku": "REV-21-3094-PK8",
    "category": "Drivetrain",
    "description": "REV-21-3094-PK8 · $26.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-21-3094-pk8/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/865/3467/REV-21-3094-MAXSwerveSpikyWheel-Tread-Hero-FINAL__12911.1734654886.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-21-3207",
    "name": "Aluminum Angle - 0.74in x 0.74in - 47in",
    "sku": "REV-21-3207",
    "category": "Structure",
    "description": "REV-21-3207 · $22.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-21-3207/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/864/3447/REV-21-3207-AluminumAngle-Hero-FINAL__81507.1734462719.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-21-2859-pk2",
    "name": "MAX Pattern Double Mount Adapter - 2 Pack",
    "sku": "REV-21-2859-PK2",
    "category": "Structure",
    "description": "REV-21-2859-PK2 · $19.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-21-2859-pk2/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/863/3440/REV-21-2859-MAXPatternDoubleMountAdapter-Hero-FINAL__03266.1733955246.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-21-3744-pk5",
    "name": "#35 Connecting Links - 5 Pack",
    "sku": "REV-21-3744-PK5",
    "category": "Parts",
    "description": "REV-21-3744-PK5 · $5.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-21-3744-pk5/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/861/3422/REV-21-3744-35ConnectingLinks-Hero-FINAL__70561.1733522985.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-21-3745",
    "name": "#35 Roller Chain - 10ft",
    "sku": "REV-21-3745",
    "category": "Gears, Chain & Belts",
    "description": "REV-21-3745 · $13.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-21-3745/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/860/3425/REV-21-3745-35Chain-Front-FINAL__05490.1733523296.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-21-3705",
    "name": "#35 Chain Turnbuckle",
    "sku": "REV-21-3705",
    "category": "Gears, Chain & Belts",
    "description": "REV-21-3705 · $11.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-21-3705/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/859/3418/REV-21-3705-35ChainTurnbuckle-Iso-FINAL__29945.1733520225.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-21-3195",
    "name": "Ballast Block - 3in x 2in x 1in",
    "sku": "REV-21-3195",
    "category": "Parts",
    "description": "REV-21-3195 · $12.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-21-3195/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/858/3413/REV-21-3195-BallastBlock-Hero-FINAL__32700.1733516724.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:shaft-collars-1-2in-hex-bore",
    "name": "Shaft Collars - 1/2in Hex Bore",
    "sku": null,
    "category": "Shafts & Axles",
    "description": "$11.00 - $12.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/Shaft-Collars-0.5in-Hex-Bore/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/856/3591/Shaft_Collars_-_0.5in_Hex_Bore-Hero-FINAL__37835.1760543066.jpg?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:maxtube-2x2",
    "name": "MAXTube - 2x2",
    "sku": null,
    "category": "Structure",
    "description": "$55.00 - $59.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/MAXTube-2x2/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/854/3382/REV-21-3286-MAXTube2x2-MAXPattern-Hero-FINAL__97360.1732749964.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:maxtube-2x1",
    "name": "MAXTube - 2x1",
    "sku": null,
    "category": "Structure",
    "description": "$4.00 - $50.75 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/MAXTube-2x1/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/853/3381/REV-21-2185-MAXTube2x1-MAXPattern-Hero-FINAL__82090.1732749034.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:maxtube-1x1",
    "name": "MAXTube - 1x1",
    "sku": null,
    "category": "Structure",
    "description": "$22.00 - $33.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/MAXTube-1x1/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/852/3380/REV-21-2160-SquareTube-Hero-FINAL__98596.1732746115.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:maxtube-1-2x1-2",
    "name": "MAXTube - 1/2x1/2",
    "sku": null,
    "category": "Structure",
    "description": "$16.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/MAXTube-0.5x0.5/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/851/3379/REV-21-3289-MAXTube0.5-Hero-FINAL__26762.1732745664.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-95-3318",
    "name": "REV Robotics Brushless Motor Accessory Pack",
    "sku": "REV-95-3318",
    "category": "Motors",
    "description": "REV-95-3318 · $175.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-95-3318/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/849/3359/REV-95-3318-BrushlessMotorAccessoryPack-Hero-FINAL__22168.1731105201.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-31-3332",
    "name": "9-Axis IMU",
    "sku": "REV-31-3332",
    "category": "Electronics & Control",
    "description": "REV-31-3332 · $38.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-31-3332/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/848/3367/REV-31-3332-9AxisIMU-HERO-FINAL__79949.1731351709.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:maxcomposite-sheets",
    "name": "MAXComposite Sheets",
    "sku": null,
    "category": "Materials & Consumables",
    "description": "$150.00 - $225.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/MAXComposite-Sheets/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/840/3358/REV-21-3098-MAXComposite-Hero-FINAL__77262.1729789067.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-21-2742",
    "name": "Linear Actuator 2in Input Shaft Kit",
    "sku": "REV-21-2742",
    "category": "Motors",
    "description": "REV-21-2742 · $5.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-21-2742/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/837/3346/REV-21-2740-LinearActuator2inInputShaft-Hero-FINAL__42353.1727190246.1280.1280__03134.1727195286.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-11-1855",
    "name": "Servo Hub",
    "sku": "REV-11-1855",
    "category": "Servo Accessories",
    "description": "REV-11-1855 · $90.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-11-1855/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/834/3472/REV-11-1855-Servo_Hub-FINAL__22851.1736875921.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:rev-sticker-bundles",
    "name": "REV Sticker Bundles",
    "sku": null,
    "category": "Merch",
    "description": "$18.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/marketing-sticker-bundles/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/828/3768/REV-Sticker-Bundle-Hero-FINAL__25510.1772579159.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-21-2750",
    "name": "MAXSpline Pillow Block",
    "sku": "REV-21-2750",
    "category": "Bearings",
    "description": "REV-21-2750 · $6.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-21-2750/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/826/3333/REV-21-2750-MAXSplinePillowBlock-Hero-FINAL__22479.1727128869.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-11-2853",
    "name": "SPARK Flex Data Port Breakout Cable",
    "sku": "REV-11-2853",
    "category": "Electronics & Control",
    "description": "REV-11-2853 · $8.75 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-11-2853/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/825/3289/REV-11-2853-SPARKFlexDataPortBreakoutCable-Top-FINAL__81022.1707851563.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-11-2852-pk4",
    "name": "SPARK Flex Data Port Pigtail Cable - 4 Pack",
    "sku": "REV-11-2852-PK4",
    "category": "Electronics & Control",
    "description": "REV-11-2852-PK4 · $13.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-11-2852-pk4/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/824/3288/REV-11-2852-SPARKFlexDataPortPigtailCable-Top-FINAL__09259.1707775537.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-25-3062",
    "name": "Differential Drivetrain Bumper Bracket Kit",
    "sku": "REV-25-3062",
    "category": "Drivetrain",
    "description": "REV-25-3062 · $75.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-25-3062/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/822/3285/REV-21-3067-BumperBracketKit-KitContentsHero-FINAL__41411.1707425591.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:maxplanetary-input-couplers",
    "name": "MAXPlanetary Input Couplers",
    "sku": null,
    "category": "Gearboxes",
    "description": "$8.75 - $10.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/maxplanetary-input-couplers/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/820/3482/MAXPlanetary_Input_Couplers-Hero-FINAL__44118.1739478661.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:maxtube-internal-supports",
    "name": "MAXTube Internal Supports",
    "sku": null,
    "category": "Structure",
    "description": "$19.50 - $26.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/maxtube-internal-supports/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/819/3475/MAXTube_Internal_Support-HERO__14979.1739308563.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:maxspline-shaft-endcaps",
    "name": "MAXSpline Shaft Endcaps",
    "sku": null,
    "category": "Shafts & Axles",
    "description": "$5.50 - $15.25 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/maxspline-shaft-endcaps/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/806/3191/REV-21-0000-MAXSplineShaftEndCap-FamilyHero-FINAL__00123.1701876940.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:ion-flap-wheels",
    "name": "ION Flap Wheels",
    "sku": null,
    "category": "Wheels",
    "description": "$10.00 - $17.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/ion-flap-wheels/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/805/3707/REV-21-6559-67-68_FlapWheel-FAMILY-FINAL__78500.1765235045.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-hand:duo-flap-wheels",
    "name": "DUO Flap Wheels",
    "sku": null,
    "category": "Wheels",
    "description": "$17.50 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/duo-flap-wheels/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/804/3189/REV-41-2701-2703-FlapWheel-5mm-FamilyHero-FINAL__78447.1701363642.png?c=2"
  },
  {
    "vendorKey": "rev-robotics",
    "externalKey": "rev-11-1852-rfb",
    "name": "Pneumatic Hub Repair Service",
    "sku": "REV-11-1852-RFB",
    "category": "Electronics & Control",
    "description": "REV-11-1852-RFB · $45.00 · In stock · REV Robotics Shop All listing (hand-collected Oct 2026)",
    "productUrl": "https://www.revrobotics.com/rev-11-1852-rfb/",
    "imageUrl": "https://cdn11.bigcommerce.com/s-t3eo8vwp22/images/stencil/2560w/products/780/3137/REV-11-1852-RFB-Pneumatic_Hub_Repair_Service__91961.1686243303.png?c=2"
  }
];
