/**
 * Studica Robot Parts catalog — complete enumeration (polite scrape, Oct 2026).
 *
Studica publishes no verified public full-catalog feed, so this seed
 * IS the vendor's robotics feed for the Parts workspace. Collection: robots.txt
 * allowed catalog crawling; 37 paginated /robot-parts listing pages
 * (?pagenumber=2..37, 16/page) walked to the end. The category reports 587
 * products and 587 were collected (36x16 + 11), deduped by URL. Non-robotics
 * Studica departments (Adobe/NI/fischertechnik/curriculum) are out of scope
 * and excluded. SKUs come from the listing's product-code markup; stock state
 * is not exposed site-wide and is omitted rather than invented.
 * Generated — do not edit by hand.
 */
export type StudicaCatalogSeedRecord = {
  vendorKey: "studica";
  externalKey: string;
  name: string;
  sku: string | null;
  category: string | null;
  description: string | null;
  productUrl: string | null;
  imageUrl: string | null;
};

export const STUDICA_CATALOG_SEED_COUNT = 587;

export const STUDICA_CATALOG_SEED: StudicaCatalogSeedRecord[] = [
  {
    "vendorKey": "studica",
    "externalKey": "40117",
    "name": "Sharp IR Range Sensor (10cm to 80cm) w/wire",
    "sku": "40117",
    "category": "Robot Parts",
    "description": "Sharp IR Range Sensor (10cm to 80cm) w/wire · $11.99 · Studica Robot Parts listing (collected Oct 2026) · The Sharp IR Distance Sensor GP2Y0A21YK0F uses a beam of infrared light to reflect off an object to measure its distance.",
    "productUrl": "https://www.studica.com/sharp-ir-range-sensor-10cm-to-80cm-w-wire",
    "imageUrl": "https://www.studica.com/images/thumbs/0003486_sharp-ir-range-sensor-10cm-to-80cm-wwire_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "40118",
    "name": "IR Range Sensor Bracket",
    "sku": "40118",
    "category": "Robot Parts",
    "description": "IR Range Sensor Bracket · $5.99 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics IR Range Sensor Bracket can be used to secure the IR Range Sensor to the Studica build structure.",
    "productUrl": "https://www.studica.com/ir-range-sensor-bracket",
    "imageUrl": "https://www.studica.com/images/thumbs/0004511_ir-range-sensor-bracket_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "40238",
    "name": "Ultrasonic Distance Sensor Bracket",
    "sku": "40238",
    "category": "Robot Parts",
    "description": "Ultrasonic Distance Sensor Bracket · $6.49 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics Ultrasonic Distance Sensor Bracket is used to secure the Ultrasonic Distance Sensor to channels.",
    "productUrl": "https://www.studica.com/ultrasonic-distance-sensor-bracket",
    "imageUrl": "https://www.studica.com/images/thumbs/0004238_ultrasonic-distance-sensor-bracket_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "638576",
    "name": "5mm 10-Tooth Bore Pulley (2 pack)",
    "sku": "638576",
    "category": "Robot Parts",
    "description": "5mm 10-Tooth Bore Pulley (2 pack) · $6.99 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 5mm 10-tooth pulleys are .40” inside the flanges to allow for belts up to 3/8” in width. Includes two set screws using a 1.5mm hex key.",
    "productUrl": "https://www.studica.com/5mm-bore-pulley-10t-2-pack",
    "imageUrl": "https://www.studica.com/images/thumbs/0009674_5mm-10-tooth-bore-pulley-2-pack_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "70017",
    "name": "10 Tooth Pulley & Timing Belt Set",
    "sku": "70017",
    "category": "Robot Parts",
    "description": "10 Tooth Pulley & Timing Belt Set · $24.99 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 10-tooth Pulley includes two 5mm Bores, two 10-Tooth Aluminum Pulleys and one 1M XL Timing belt.",
    "productUrl": "https://www.studica.com/10-tooth-pulley-2-timing-belt-set",
    "imageUrl": "https://www.studica.com/images/thumbs/0009655_10-tooth-pulley-timing-belt-set_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "70148",
    "name": "Colore Color Sensor",
    "sku": "70148",
    "category": "Robot Parts",
    "description": "Colore Color Sensor · $79.00 · Studica Robot Parts listing (collected Oct 2026) · High‑Accuracy Spectral & Color Sensing for Robotics The Colore Color Sensor provides precise, repeatable color and spectral light measurement for robotic and industrial applications. With wide spectral coverage and factory calibration, Colore delivers consistent, reliable data for color detection, material identification, and lighting analysis. Colore features 14‑channel spectral sensing across 380 nm to 1000 nm , covering visible and near‑infrared light, plus a clear channel for accurate bright",
    "productUrl": "https://www.studica.com/colore-color-sensor",
    "imageUrl": "https://www.studica.com/images/thumbs/0019362_colore-color-sensor_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "70149",
    "name": "Parsec Distance Sensor",
    "sku": "70149",
    "category": "Robot Parts",
    "description": "Parsec Distance Sensor · $99.00 · Studica Robot Parts listing (collected Oct 2026) · High‑Precision Depth Sensing for Robotics The Parsec Distance Sensor delivers fast, accurate, multi‑zone depth sensing in a rugged industrial package. Designed for robotic navigation, obstacle detection, and spatial awareness, Parsec combines millimeter‑level precision with reliable performance in real‑world environments. With 64 independent depth zones , Parsec measures distances from 2 cm to 400 cm at up to ~1 mm precision , all within a wide 65° field of view . Choose 15 Hz or 60 Hz output mo",
    "productUrl": "https://www.studica.com/parsec-distance-sensor",
    "imageUrl": "https://www.studica.com/images/thumbs/0018862_parsec-distance-sensor_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "70151",
    "name": "Cobra Line Follower Sensor",
    "sku": "70151",
    "category": "Robot Parts",
    "description": "Cobra Line Follower Sensor · $9.99 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics Cobra Line Follower Array provides 4 X QRE1113 IR reflectance sensor mounted on a 9mm pitch. Each sensor is comprised of two parts - an IR emitting LED and an IR sensitive phototransistor. When you apply power to the VCC and GND pins the IR LED inside the sensor will illuminate.",
    "productUrl": "https://www.studica.com/cobra-line-follower-sensor",
    "imageUrl": "https://www.studica.com/images/thumbs/0009942_cobra-line-follower-sensor_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "70152",
    "name": "Titan Quad Motor Controller",
    "sku": "70152",
    "category": "Robot Parts",
    "description": "Titan Quad Motor Controller · $449.00 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics Titan Quad Motor Controller is a powerful, 4-channel CAN BUS -based motor controller with a built-in fuse-box (for DC motors up to 20A).",
    "productUrl": "https://www.studica.com/titan-quad-motor-controller",
    "imageUrl": "https://www.studica.com/images/thumbs/0004268_titan-quad-motor-controller_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "70163",
    "name": "Maverick Encoder Cable for FTC",
    "sku": "70163",
    "category": "Robot Parts",
    "description": "Maverick Encoder Cable for FTC · $8.99 · Studica Robot Parts listing (collected Oct 2026) · The Maverick Encoder Cable for FTC will connect the Maverick DC Gear Motor to the REV Control Hub.",
    "productUrl": "https://www.studica.com/maverick-encoder-cable-for-ftc",
    "imageUrl": "https://www.studica.com/images/thumbs/0017502_maverick-encoder-cable-for-ftc_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "70174",
    "name": "VMX2 Robotics Controller",
    "sku": "70174",
    "category": "Robot Parts",
    "description": "VMX2 Robotics Controller · $449.00 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics VMX 2 Robotics Controller is a versatile and high-performance solution for robotics control. With advanced processing, rich sensor support, and robust I/O capabilities, it is designed for demanding educational and competition environments such as FRC, and custom robotics platforms.",
    "productUrl": "https://www.studica.com/vmx2-robotics-controller",
    "imageUrl": "https://www.studica.com/images/thumbs/0018493_vmx2-robotics-controller_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "70184",
    "name": "Power Switch Plate",
    "sku": "70184",
    "category": "Robot Parts",
    "description": "Power Switch Plate · $4.99 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics Power Switch Plate is for use with the Power Switch (part# 70183).",
    "productUrl": "https://www.studica.com/power-switch-plate",
    "imageUrl": "https://www.studica.com/images/thumbs/0007406_power-switch-plate_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "70254h",
    "name": "Servo Pack - Hex Shaft",
    "sku": "70254H",
    "category": "Robot Parts",
    "description": "Servo Pack - Hex Shaft · $369.00 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics Servo Pack - Hex Shaft is a complete servo motor and hardware bundle designed for robotics builders, educators, and competition teams. This all-in-one set includes eight multi-mode smart servo motors , a smart robot servo programmer , a 6 V battery holder , a servo power block , multiple servo mounting plates , servo horns , and 6 mm Hex-shaft servo hubs — giving you everything you need to integrate servos into robot mechanisms, linkages, and control systems.",
    "productUrl": "https://www.studica.com/servo-pack-hex-shaft",
    "imageUrl": "https://www.studica.com/images/thumbs/0018828_servo-pack-hex-shaft_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "70255",
    "name": "Wheel Pack",
    "sku": "70255",
    "category": "Robot Parts",
    "description": "Wheel Pack · $229.00 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics Wheel Pack contains an assortment of drive wheels, omni wheels, D-shafts, bushings, shaft hubs, a bearing and a shaft spacer for your robotics competition designs.",
    "productUrl": "https://www.studica.com/wheel-pack",
    "imageUrl": "https://www.studica.com/images/thumbs/0017519_wheel-pack_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "70257",
    "name": "Pro Gear Pack",
    "sku": "70257",
    "category": "Robot Parts",
    "description": "Pro Gear Pack · $187.00 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics Pro Gear Pack includes 13, 26 and 30 tooth bevel gears, rack & pinion, shaft hubs and socket head cap screws, ideal for your robotics designs.",
    "productUrl": "https://www.studica.com/pro-gear-pack",
    "imageUrl": "https://www.studica.com/images/thumbs/0004258_pro-gear-pack_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "70258",
    "name": "Fastener pack",
    "sku": "70258",
    "category": "Robot Parts",
    "description": "Fastener pack · $139.00 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics Fastener Pack includes socket head cap screws, kep nuts, nyloc nuts, a screwdriver and a wrench, ideal for your robotics designs.",
    "productUrl": "https://www.studica.com/fastener-pack",
    "imageUrl": "https://www.studica.com/images/thumbs/0004257_fastener-pack_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "70260",
    "name": "#25 Chain and Sprocket Pack",
    "sku": "70260",
    "category": "Robot Parts",
    "description": "#25 Chain and Sprocket Pack · $199.00 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics #25 Chain and Sprocket Pack includes a #25 chain, a variety of sprockets, bronze bushings, shaft hubs, spacers, screws, collars and a chain breaker tool, ideal for your robotics designs.",
    "productUrl": "https://www.studica.com/no-25-chain-and-sprocket-pack",
    "imageUrl": "https://www.studica.com/images/thumbs/0009743_25-chain-and-sprocket-pack_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "70260h",
    "name": "HEX Chain and Sprocket Pack",
    "sku": "70260H",
    "category": "Robot Parts",
    "description": "HEX Chain and Sprocket Pack · $199.00 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics HEX Chain and Sprocket Pack is a complete power transmission hardware kit built for competitive robotics, classroom projects, and custom mechanical designs. This comprehensive pack includes a heavy-duty #25 roller chain with master links, a variety of precision sprockets , flanged bearings, shaft hubs, spacers, collars, socket head cap screws, and a chain breaker tool — giving you everything needed to build efficient drivetrain systems or other mechanical linkages.",
    "productUrl": "https://www.studica.com/hex-chain-and-sprocket-pack",
    "imageUrl": "https://www.studica.com/images/thumbs/0018827_hex-chain-and-sprocket-pack_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "70261",
    "name": "Gear Pack",
    "sku": "70261",
    "category": "Robot Parts",
    "description": "Gear Pack · $189.00 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics Gear Pack includes 32, 64 and 128 tooth gears, D-shaft hubs and socket head cap screws, ideal for your robotics designs.",
    "productUrl": "https://www.studica.com/gear-pack",
    "imageUrl": "https://www.studica.com/images/thumbs/0004254_gear-pack_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "70263",
    "name": "Motor Pack",
    "sku": "70263",
    "category": "Robot Parts",
    "description": "Motor Pack · $189.00 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics Motor Pack includes all you need to connect to your robotics model for use in classroom learning and competitions. 4 Maverick 12V DC Gear Motor w/Encoder (part #75001) are included.",
    "productUrl": "https://www.studica.com/motor-pack",
    "imageUrl": "https://www.studica.com/images/thumbs/0004252_motor-pack_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "70753",
    "name": "Ultrasonic Distance Sensor",
    "sku": "70753",
    "category": "Robot Parts",
    "description": "Ultrasonic Distance Sensor · $19.99 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics Ultrasonic Distance Sensor provides stable, accurate and high precision distance measurements.",
    "productUrl": "https://www.studica.com/ultrasonic-distance-sensor",
    "imageUrl": "https://www.studica.com/images/thumbs/0004239_ultrasonic-distance-sensor_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "71015",
    "name": "Electronics Mounting Plate for Workshop",
    "sku": "71015",
    "category": "Robot Parts",
    "description": "Electronics Mounting Plate for Workshop · $10.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/electronics-mounting-plate-for-workshop",
    "imageUrl": "https://www.studica.com/images/thumbs/0008648_electronics-mounting-plate-for-workshop_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "71040-2",
    "name": "NavX2 IMU Robotics Navigation Sensor w/Case & Cable",
    "sku": "71040-2",
    "category": "Robot Parts",
    "description": "NavX2 IMU Robotics Navigation Sensor w/Case & Cable · $109.00 · Studica Robot Parts listing (collected Oct 2026) · The NavX2 IMU Robotics Navigation Sensor (navX2-Micro) is a great sensor for orientation in competitive robots. The navX2-Micro is a second-generation 9-axis inertial/magnetic sensor and motion processor.",
    "productUrl": "https://www.studica.com/nav2-micro-9-axis-inertial-magnetic-sensor-w-case-cable",
    "imageUrl": "https://www.studica.com/images/thumbs/0015122_navx2-imu-robotics-navigation-sensor-wcase-cable_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "71042",
    "name": "NavX2 MXP IMU Robotics Navigation Sensor",
    "sku": "71042",
    "category": "Robot Parts",
    "description": "NavX2 MXP IMU Robotics Navigation Sensor · $109.00 · Studica Robot Parts listing (collected Oct 2026) · BRAND NEW NEXT-GENERATION IMU SENSOR FOR ROBOTS NOW AVAILABLE - Leveraging new sensor technologies and state-of-the-art algorithms to deliver a leap forward in accuracy and performance. This “Generation 2” navX2-MXP is a drop-in replacement for the “Classic” navX-MXP, adding significant performance enhancements to your robot project. See the full Product Overview below for more information about navX2-MXP's new and enhanced capabilities. Enhance your robot's navigation performance with the NavX2",
    "productUrl": "https://www.studica.com/nav2-mxp-robotics-imu-navigation-sensor",
    "imageUrl": "https://www.studica.com/images/thumbs/0018436_navx2-mxp-imu-robotics-navigation-sensor_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "72030",
    "name": "Robotics Sensor & Motor Training Kit",
    "sku": "72030",
    "category": "Robot Parts",
    "description": "Robotics Sensor & Motor Training Kit · $999.00 · Studica Robot Parts listing (collected Oct 2026) · The Robotics Sensor & Motor Training Kit from Studica Robotics is an affordable turnkey solution that allows you to teach your students how to control sensors and motors using LabVIEW and NI myRIO. It includes two project boards, one with different motors and the other board with most of the standard robotics sensors. Learn How to Control Motors, Sensors & Actuators with LabVIEW & NI myRIO. (NI myRIO, LabView and computer are not included).",
    "productUrl": "https://www.studica.com/robotics-sensor-motor-training-kit-72030_1",
    "imageUrl": "https://www.studica.com/images/thumbs/0002799_robotics-sensor-motor-training-kit_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "74001",
    "name": "Robot Base Plate (Blue)",
    "sku": "74001",
    "category": "Robot Parts",
    "description": "Robot Base Plate (Blue) · $42.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/robot-base-plate-288mm-336mm-3mm",
    "imageUrl": "https://www.studica.com/images/thumbs/0017542_robot-base-plate-blue_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "75001",
    "name": "Maverick 12V DC Gear Motor 61:1  w/Encoder",
    "sku": "75001",
    "category": "Robot Parts",
    "description": "Maverick 12V DC Gear Motor 61:1  w/Encoder · $28.99 · Studica Robot Parts listing (collected Oct 2026) · The Maverick 12V DC Gear Motor 61:1 w/Encoder from Studica Robotics is an ideal high torque motor for robotics, designed for strength to endure competitions, with 100rpm and 708 oz-in of torque. To connect to the REV Robotics Control Hub, the Maverick Encoder Cable (#70163) is required as an Add-on. Note: This motor is legal for FIRST (FTC) competitions.",
    "productUrl": "https://www.studica.com/maverick-12v-dc-gear-motor-with-encoder",
    "imageUrl": "https://www.studica.com/images/thumbs/0004207_maverick-12v-dc-gear-motor-611-wencoder_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "75001-11",
    "name": "Maverick Planetary DC Gear Motor (1:1 ratio, 12V, w/Encoder, 6mm hex shaft)",
    "sku": "75001-11",
    "category": "Robot Parts",
    "description": "Maverick Planetary DC Gear Motor (1:1 ratio, 12V, w/Encoder, 6mm hex shaft) · $49.99 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics Maverick Planetary DC Gear Motor w/ Encoder combines a robust 12V DC brushed drive motor with a precision 1:1 planetary gearbox and high-resolution Hall-effect encoder. Designed for competitive robotics (FTC legal) and advanced automation applications, this motor delivers smooth output, high torque and accurate control. Comes with an encoder cable. Shafts: 6mm hex with a 3mm tapped end A 1:1 gearbox comes standard. Encoder Output Counts per Revolution of Output Shaft (cpr) 2",
    "productUrl": "https://www.studica.com/maverick-planetary-dc-gear-motor-wencoder-11-ratio-gearbox",
    "imageUrl": "https://www.studica.com/images/thumbs/0018680_maverick-planetary-dc-gear-motor-11-ratio-12v-wencoder-6mm-hex-shaft_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "75001-137",
    "name": "Maverick Planetary DC Gear Motor (13.7:1 ratio, 12V, w/Encoder, 6mm hex shaft)",
    "sku": "75001-137",
    "category": "Robot Parts",
    "description": "Maverick Planetary DC Gear Motor (13.7:1 ratio, 12V, w/Encoder, 6mm hex shaft) · $49.99 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics Maverick Planetary DC Gear Motor combines a robust 12V DC brushed drive motor with a precision 13.7:1 planetary gearbox and high-resolution Hall-effect encoder. Designed for competitive robotics (FTC legal) and advanced automation applications, this motor delivers smooth output, high torque and accurate control. Comes with an encoder cable. Shafts: 6mm hex with a 3mm tapped end A 13.7:1 gearbox comes standard. Encoder Output Counts per Revolution of Output Shaft (cpr) 328.8 ",
    "productUrl": "https://www.studica.com/maverick-planetary-dc-gearbox-motor-wencoder-1371-ratio-gearbox",
    "imageUrl": "https://www.studica.com/images/thumbs/0018679_maverick-planetary-dc-gear-motor-1371-ratio-12v-wencoder-6mm-hex-shaft_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "75001-139",
    "name": "Maverick Planetary DC Gear Motor (139:1 ratio, 12V, w/Encoder, 6mm hex shaft)",
    "sku": "75001-139",
    "category": "Robot Parts",
    "description": "Maverick Planetary DC Gear Motor (139:1 ratio, 12V, w/Encoder, 6mm hex shaft) · $54.99 · Studica Robot Parts listing (collected Oct 2026) · The Maverick Planetary DC Gear Motor with 139:1 planetary gearbox features a high‑torque reduction system engineered for demanding robotic and automation applications. Its 6mm hex output shaft ensures secure coupling with Studica‑compatible components and other hex‑based mechanical systems. Built on Studica’s industrial‑grade motor platform, this unit provides reliable, consistent performance suited for precision‑controlled, heavy‑load mechanisms.",
    "productUrl": "https://www.studica.com/maverick-hex-planetary-gearbox-motor-wencoder-1391-ratio-gearbox",
    "imageUrl": "https://www.studica.com/images/thumbs/0019184_maverick-planetary-dc-gear-motor-1391-ratio-12v-wencoder-6mm-hex-shaft_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "75001-188",
    "name": "Maverick Planetary DC Gear Motor (188:1 ratio, 12V, w/Encoder, 6mm hex shaft)",
    "sku": "75001-188",
    "category": "Robot Parts",
    "description": "Maverick Planetary DC Gear Motor (188:1 ratio, 12V, w/Encoder, 6mm hex shaft) · $58.49 · Studica Robot Parts listing (collected Oct 2026) · The Maverick Planetary DC Gear Motor with 188:1 planetary gearbox features a high‑torque reduction system engineered for demanding robotic and automation applications. Its 6mm hex output shaft ensures secure coupling with Studica‑compatible components and other hex‑based mechanical systems. Built on Studica’s industrial‑grade motor platform, this unit provides reliable, consistent performance suited for precision‑controlled, heavy‑load mechanisms.",
    "productUrl": "https://www.studica.com/maverick-hex-planetary-gearbox-motor-wencoder-1881-ratio-gearbox",
    "imageUrl": "https://www.studica.com/images/thumbs/0019185_maverick-planetary-dc-gear-motor-1881-ratio-12v-wencoder-6mm-hex-shaft_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "75001-192",
    "name": "Maverick Planetary DC Gear Motor (19.2:1 ratio, 12V, w/Encoder, 6mm hex shaft)",
    "sku": "75001-192",
    "category": "Robot Parts",
    "description": "Maverick Planetary DC Gear Motor (19.2:1 ratio, 12V, w/Encoder, 6mm hex shaft) · $49.99 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics Maverick Planetary DC Gear Motor combines a robust 12V DC brushed drive motor with a precision 19.2:1 planetary gearbox and high-resolution Hall-effect encoder. Designed for competitive robotics (FTC legal) and advanced automation applications, this motor delivers smooth output, high torque and accurate control. Comes with an encoder cable. Shafts: 6mm hex with a 3mm tapped end A 19.2:1 gearbox comes standard. Encoder Output Counts per Revolution of Output Shaft (cpr) 460.8 ",
    "productUrl": "https://www.studica.com/maverick-planetary-dc-gear-motor-1921-ratio-gearbox",
    "imageUrl": "https://www.studica.com/images/thumbs/0018678_maverick-planetary-dc-gear-motor-1921-ratio-12v-wencoder-6mm-hex-shaft_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "75001-269",
    "name": "Maverick Planetary DC Gear Motor (26.9:1 ratio, 12V, w/Encoder, 6mm hex shaft)",
    "sku": "75001-269",
    "category": "Robot Parts",
    "description": "Maverick Planetary DC Gear Motor (26.9:1 ratio, 12V, w/Encoder, 6mm hex shaft) · $49.99 · Studica Robot Parts listing (collected Oct 2026) · The Maverick Planetary DC Gear Motor with 26.9:1 planetary gearbox features a high‑torque reduction system engineered for demanding robotic and automation applications. Its 6mm hex output shaft ensures secure coupling with Studica‑compatible components and other hex‑based mechanical systems. Built on Studica’s industrial‑grade motor platform, this unit provides reliable, consistent performance suited for precision‑controlled, heavy‑load mechanisms.",
    "productUrl": "https://www.studica.com/maverick-hex-planetary-gearbox-motor-wencoder-2691-ratio-gearbox",
    "imageUrl": "https://www.studica.com/images/thumbs/0019181_maverick-planetary-dc-gear-motor-2691-ratio-12v-wencoder-6mm-hex-shaft_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "75001-37",
    "name": "Maverick Planetary DC Gear Motor (3.7:1 ratio, 12V, w/Encoder, 6mm hex shaft)",
    "sku": "75001-37",
    "category": "Robot Parts",
    "description": "Maverick Planetary DC Gear Motor (3.7:1 ratio, 12V, w/Encoder, 6mm hex shaft) · $49.99 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics Maverick Planetary DC Gear Motor w/ Encoder combines a robust 12V DC brushed drive motor with a precision 3.7.:1 planetary gearbox and high-resolution Hall-effect encoder. Designed for competitive robotics (FTC legal) and advanced automation applications, this motor delivers smooth output, high torque and accurate control. Comes with an encoder cable. Shafts: 6mm hex with a 3mm tapped end A 3.7:1 gearbox comes standard. Encoder Output Counts per Revolution of Output Shaft (c",
    "productUrl": "https://www.studica.com/maverick-planetary-dc-gear-motor-wencoder-371-ratio-gearbox",
    "imageUrl": "https://www.studica.com/images/thumbs/0018681_maverick-planetary-dc-gear-motor-371-ratio-12v-wencoder-6mm-hex-shaft_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "75001-509",
    "name": "Maverick Planetary DC Gear Motor (50.9:1 ratio, 12V, w/Encoder, 6mm hex shaft)",
    "sku": "75001-509",
    "category": "Robot Parts",
    "description": "Maverick Planetary DC Gear Motor (50.9:1 ratio, 12V, w/Encoder, 6mm hex shaft) · $49.99 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics Maverick Planetary DC Gear Motor w/ Encoder combines a robust 12V DC brushed drive motor with a precision 50.9:1 planetary gearbox and high-resolution Hall-effect encoder. Designed for competitive robotics (FTC legal) and advanced automation applications, this motor delivers smooth output, high torque and accurate control. Comes with an encoder cable. Shafts: 6mm hex with a 3mm tapped end A 50.9:1 gearbox comes standard. Encoder Output Counts per Revolution of Output Shaft (",
    "productUrl": "https://www.studica.com/maverick-planetary-dc-gear-motor-wencoder-5091-ratio-gearbox",
    "imageUrl": "https://www.studica.com/images/thumbs/0018682_maverick-planetary-dc-gear-motor-5091-ratio-12v-wencoder-6mm-hex-shaft_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "75001-52",
    "name": "Maverick Planetary DC Gear Motor (5.2:1 ratio, 12V, w/Encoder, 6mm hex shaft)",
    "sku": "75001-52",
    "category": "Robot Parts",
    "description": "Maverick Planetary DC Gear Motor (5.2:1 ratio, 12V, w/Encoder, 6mm hex shaft) · $49.99 · Studica Robot Parts listing (collected Oct 2026) · The Maverick Planetary DC Gear Motor with 5.2:1 planetary gearbox features a high‑torque reduction system engineered for demanding robotic and automation applications. Its 6mm hex output shaft ensures secure coupling with Studica‑compatible components and other hex‑based mechanical systems. Built on Studica’s industrial‑grade motor platform, this unit provides reliable, consistent performance suited for precision‑controlled, heavy‑load mechanisms.",
    "productUrl": "https://www.studica.com/maverick-hex-planetary-gearbox-motor-wencoder-521-ratio-gearbox",
    "imageUrl": "https://www.studica.com/images/thumbs/0019180_maverick-planetary-dc-gear-motor-521-ratio-12v-wencoder-6mm-hex-shaft_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "75001-712",
    "name": "Maverick Planetary DC Gear Motor (71.2:1 ratio, 12V, w/Encoder, 6mm hex shaft)",
    "sku": "75001-712",
    "category": "Robot Parts",
    "description": "Maverick Planetary DC Gear Motor (71.2:1 ratio, 12V, w/Encoder, 6mm hex shaft) · $49.99 · Studica Robot Parts listing (collected Oct 2026) · The Maverick Planetary DC Gear Motor with 71.2:1 planetary gearbox features a high‑torque reduction system engineered for demanding robotic and automation applications. Its 6mm hex output shaft ensures secure coupling with Studica‑compatible components and other hex‑based mechanical systems. Built on Studica’s industrial‑grade motor platform, this unit provides reliable, consistent performance suited for precision‑controlled, heavy‑load mechanisms.",
    "productUrl": "https://www.studica.com/maverick-hex-planetary-gearbox-motor-wencoder-7121-ratio-gearbox",
    "imageUrl": "https://www.studica.com/images/thumbs/0019182_maverick-planetary-dc-gear-motor-7121-ratio-12v-wencoder-6mm-hex-shaft_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "75001-995",
    "name": "Maverick Planetary DC Gear Motor (99.5:1 ratio, 12V, w/Encoder, 6mm hex shaft)",
    "sku": "75001-995",
    "category": "Robot Parts",
    "description": "Maverick Planetary DC Gear Motor (99.5:1 ratio, 12V, w/Encoder, 6mm hex shaft) · $49.99 · Studica Robot Parts listing (collected Oct 2026) · The Maverick Planetary DC Gear Motor with 99.5:1 planetary gearbox features a high‑torque reduction system engineered for demanding robotic and automation applications. Its 6mm hex output shaft ensures secure coupling with Studica‑compatible components and other hex‑based mechanical systems. Built on Studica’s industrial‑grade motor platform, this unit provides reliable, consistent performance suited for precision‑controlled, heavy‑load mechanisms.",
    "productUrl": "https://www.studica.com/maverick-hex-planetary-gearbox-motor-wencoder-9951-ratio-gearbox",
    "imageUrl": "https://www.studica.com/images/thumbs/0019183_maverick-planetary-dc-gear-motor-9951-ratio-12v-wencoder-6mm-hex-shaft_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "75002",
    "name": "Multi-Mode Smart Servo Motor",
    "sku": "75002",
    "category": "Robot Parts",
    "description": "Multi-Mode Smart Servo Motor · $28.99 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics Multi-Mode Smart Servo Motor is a versatile, programmable servo perfect for robotics and STEM projects. Featuring steel gears , dual ball bearings , and modes including standard (±150°) , continuous rotation , and custom angular , it delivers high torque and flexibility. Fully FTC-legal , the servo is ideal for competition, classroom, DIY or RC hobbyist use. Note: This servo motor is legal for FIRST Tech Challenge (FTC) competitions.",
    "productUrl": "https://www.studica.com/multi-mode-smart-servo",
    "imageUrl": "https://www.studica.com/images/thumbs/0017850_multi-mode-smart-servo-motor_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "75003",
    "name": "Smart Robot Servo Programmer",
    "sku": "75003",
    "category": "Robot Parts",
    "description": "Smart Robot Servo Programmer · $12.99 · Studica Robot Parts listing (collected Oct 2026) · The Studica Smart Robot Servo Programmer is used for programming the Studica Multi-Model Smart Servo Motor and for testing other standard Servos. Use it to program the Studica Servo motors to switch between continuous mode, standard mode, or any custom angular mode. Specifications: Requires 6 Volt battery pack with TJC8 connector or use the Studica 6V DC Battery Holder . Programming setting modes Standard Continuous Angular",
    "productUrl": "https://www.studica.com/smart-robot-servo-programmer-2",
    "imageUrl": "https://www.studica.com/images/thumbs/0004205_smart-robot-servo-programmer_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "75004",
    "name": "6V DC Battery Holder for Smart Robotics Servo Programmer",
    "sku": "75004",
    "category": "Robot Parts",
    "description": "6V DC Battery Holder for Smart Robotics Servo Programmer · $4.99 · Studica Robot Parts listing (collected Oct 2026) · Used to power the Studica Smart Robot Servo Programmer or any other device requiring 6V output and a TJC8 connector. Specifications: 6V Output On/Off Power switch TJC8 connector Uses 4 x 1.5V AA Batteries (not included)",
    "productUrl": "https://www.studica.com/6v-dc-battery-holder-for-smart-robotics-servo-programmer",
    "imageUrl": "https://www.studica.com/images/thumbs/0019307_6v-dc-battery-holder-for-smart-robotics-servo-programmer_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "75006",
    "name": "Servo Power Block",
    "sku": "75006",
    "category": "Robot Parts",
    "description": "Servo Power Block · $36.99 · Studica Robot Parts listing (collected Oct 2026) · The Servo Power Block is a 6V, 60W power injector that provides proper power for RC Servos. It does not interfere with the signal, it will only replace the power to the servo with 6V. Note: This servo power block is legal for FIRST (FTC) competitions.",
    "productUrl": "https://www.studica.com/servo-power-block",
    "imageUrl": "https://www.studica.com/images/thumbs/0004201_servo-power-block_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "75011",
    "name": "Linear Servo RC Actuator 50S-190N",
    "sku": "75011",
    "category": "Robot Parts",
    "description": "Linear Servo RC Actuator 50S-190N · $46.99 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics Linear Servo RC Actuator 50S-190N is a new linear servo motor which has a stroke of 50mm and a max force of 190N. Note: This actuator is legal for FIRST (FTC) competitions.",
    "productUrl": "https://www.studica.com/linear-rc-actuator-50mm-200n",
    "imageUrl": "https://www.studica.com/images/thumbs/0014240_linear-servo-rc-actuator-50s-190n_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "75012",
    "name": "Linear Servo RC Actuator 50S-40N",
    "sku": "75012",
    "category": "Robot Parts",
    "description": "Linear Servo RC Actuator 50S-40N · $46.99 · Studica Robot Parts listing (collected Oct 2026) · The Studica Linear Servo RC Actuator 50S-40N is a new Servo motor which has a stroke of 50mm, Max Force load of 50N and stroke spead of 26mm/s. It works the same way as the any standard rotary servo but in a linear movement. It uses the same 2.54mm Dupont 3-Pin Female wire connector and can be controlled with an RC receiver or any device that controls a servo. Includes mounting brackets. Note: This actuator is legal for FIRST (FTC) competitions.",
    "productUrl": "https://www.studica.com/linear-servo-rc-actuator-50s-40n",
    "imageUrl": "https://www.studica.com/images/thumbs/0017664_linear-servo-rc-actuator-50s-40n_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "75014",
    "name": "Linear Servo RC Actuator 140S-190N",
    "sku": "75014",
    "category": "Robot Parts",
    "description": "Linear Servo RC Actuator 140S-190N · $49.99 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics Linear Servo RC Actuator 140S-190N is a new linear servo motor which has a stroke of 140mm and a max force of 190N. Note: This actuator is legal for FIRST (FTC) competitions.",
    "productUrl": "https://www.studica.com/linear-rc-actuator-140mm-200n",
    "imageUrl": "https://www.studica.com/images/thumbs/0014244_linear-servo-rc-actuator-140s-190n_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "75015",
    "name": "Linear Servo RC Actuator 140S-40N",
    "sku": "75015",
    "category": "Robot Parts",
    "description": "Linear Servo RC Actuator 140S-40N · $49.99 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics Linear Servo RC Actuator 140S-40N is a new Servo motor which has a stroke of 140mm, a load force of 50N and a speed of 26mm/s. It works the same way as the any standard rotary servo but in a linear movement. It uses the same 2.54mm Dupont 3-Pin Female wire connector and can be controlled with an RC receiver or any device that controls a servo. Includes mounting brackets. Note: This actuator is legal for FIRST (FTC) competitions.",
    "productUrl": "https://www.studica.com/linear-servo-rc-actuator-140s-40n",
    "imageUrl": "https://www.studica.com/images/thumbs/0017665_linear-servo-rc-actuator-140s-40n_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76010",
    "name": "432mm U-Channel (Blue)",
    "sku": "76010",
    "category": "Robot Parts",
    "description": "432mm U-Channel (Blue) · $17.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/432mm-u-channel-blue",
    "imageUrl": "https://www.studica.com/images/thumbs/0017373_432mm-u-channel-blue_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76010-bk",
    "name": "432mm U-Channel (Black)",
    "sku": "76010-bk",
    "category": "Robot Parts",
    "description": "432mm U-Channel (Black) · $17.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/432mm-u-channel-black",
    "imageUrl": "https://www.studica.com/images/thumbs/0017378_432mm-u-channel-black_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76010-cl",
    "name": "432mm U-Channel (Silver)",
    "sku": "76010-cl",
    "category": "Robot Parts",
    "description": "432mm U-Channel (Silver) · $15.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/432mm-u-channel-clear",
    "imageUrl": "https://www.studica.com/images/thumbs/0017374_432mm-u-channel-silver_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76010-gd",
    "name": "432mm U-Channel (Gold)",
    "sku": "76010-gd",
    "category": "Robot Parts",
    "description": "432mm U-Channel (Gold) · $17.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/432mm-u-channel-gold",
    "imageUrl": "https://www.studica.com/images/thumbs/0017375_432mm-u-channel-gold_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76010-gn",
    "name": "432mm U-Channel (Green)",
    "sku": "76010-gn",
    "category": "Robot Parts",
    "description": "432mm U-Channel (Green) · $17.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/432mm-u-channel-green",
    "imageUrl": "https://www.studica.com/images/thumbs/0017376_432mm-u-channel-green_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76010-rd",
    "name": "432mm U-Channel (Red)",
    "sku": "76010-rd",
    "category": "Robot Parts",
    "description": "432mm U-Channel (Red) · $17.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/432mm-u-channel-red",
    "imageUrl": "https://www.studica.com/images/thumbs/0017377_432mm-u-channel-red_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76010gp",
    "name": "432mm U-Channel",
    "sku": "76010GP",
    "category": "Robot Parts",
    "description": "432mm U-Channel · price not listed · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 432mm U-Channel, available in six different colors, is 3mm thick and has a 48mm x 48mm profile. As with the other Studica Robotics building components, it has the common hole pattern which makes it easy to connect to other structure with very little or no additional machining required. You can easily connect to other channel, extrusions, bushings, bearing, mounting brackets and more so you can quickly assemble and disassemble robots and automated systems. T hese anodized, de",
    "productUrl": "https://www.studica.com/432mm-u-channel-3",
    "imageUrl": "https://www.studica.com/images/thumbs/0017972_432mm-u-channel_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76011",
    "name": "384mm U-Channel (Blue)",
    "sku": "76011",
    "category": "Robot Parts",
    "description": "384mm U-Channel (Blue) · $16.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/384mm-u-channel-blue",
    "imageUrl": "https://www.studica.com/images/thumbs/0017361_384mm-u-channel-blue_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76011-bk",
    "name": "384mm U-Channel (Black)",
    "sku": "76011-bk",
    "category": "Robot Parts",
    "description": "384mm U-Channel (Black) · $16.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/384mm-u-channel-black",
    "imageUrl": "https://www.studica.com/images/thumbs/0017366_384mm-u-channel-black_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76011-cl",
    "name": "384mm U-Channel (Silver)",
    "sku": "76011-cl",
    "category": "Robot Parts",
    "description": "384mm U-Channel (Silver) · $14.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/384mm-u-channel-clear",
    "imageUrl": "https://www.studica.com/images/thumbs/0017362_384mm-u-channel-silver_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76011-gd",
    "name": "384mm U-Channel (Gold)",
    "sku": "76011-gd",
    "category": "Robot Parts",
    "description": "384mm U-Channel (Gold) · $16.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/384mm-u-channel-gold",
    "imageUrl": "https://www.studica.com/images/thumbs/0017363_384mm-u-channel-gold_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76011-gn",
    "name": "384mm U-Channel (Green)",
    "sku": "76011-gn",
    "category": "Robot Parts",
    "description": "384mm U-Channel (Green) · $16.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/384mm-u-channel-green",
    "imageUrl": "https://www.studica.com/images/thumbs/0017364_384mm-u-channel-green_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76011-rd",
    "name": "384mm U-Channel (Red)",
    "sku": "76011-rd",
    "category": "Robot Parts",
    "description": "384mm U-Channel (Red) · $16.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/384mm-u-channel-red",
    "imageUrl": "https://www.studica.com/images/thumbs/0017365_384mm-u-channel-red_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76011gp",
    "name": "384mm U-Channel",
    "sku": "76011GP",
    "category": "Robot Parts",
    "description": "384mm U-Channel · price not listed · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 384mm U-Channel, available in six different colors, is 3mm thick and has a 48mm x 48mm profile. As with the other Studica Robotics building components, it has the common hole pattern which makes it easy to connect to other structure with very little or no additional machining required. You can easily connect to other channel, extrusions, bushings, bearing, mounting brackets and more so you can quickly assemble and disassemble robots and automated systems. T hese anodized, de",
    "productUrl": "https://www.studica.com/384mm-u-channel-3",
    "imageUrl": "https://www.studica.com/images/thumbs/0017968_384mm-u-channel_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76012",
    "name": "336mm U-Channel (Blue)",
    "sku": "76012",
    "category": "Robot Parts",
    "description": "336mm U-Channel (Blue) · $13.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/336mm-u-channel-blue",
    "imageUrl": "https://www.studica.com/images/thumbs/0016602_336mm-u-channel-blue_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76012-bk",
    "name": "336mm U-Channel (Black)",
    "sku": "76012-bk",
    "category": "Robot Parts",
    "description": "336mm U-Channel (Black) · $13.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/336mm-u-channel-black",
    "imageUrl": "https://www.studica.com/images/thumbs/0016610_336mm-u-channel-black_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76012-cl",
    "name": "336mm U-Channel (Silver)",
    "sku": "76012-cl",
    "category": "Robot Parts",
    "description": "336mm U-Channel (Silver) · $12.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/336mm-u-channel-clear",
    "imageUrl": "https://www.studica.com/images/thumbs/0016608_336mm-u-channel-silver_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76012-gd",
    "name": "336mm U-Channel (Gold)",
    "sku": "76012-gd",
    "category": "Robot Parts",
    "description": "336mm U-Channel (Gold) · $13.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/336mm-u-channel-gold",
    "imageUrl": "https://www.studica.com/images/thumbs/0016596_336mm-u-channel-gold_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76012-gn",
    "name": "336mm U-Channel (Green)",
    "sku": "76012-gn",
    "category": "Robot Parts",
    "description": "336mm U-Channel (Green) · $13.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/336mm-u-channel-green",
    "imageUrl": "https://www.studica.com/images/thumbs/0016595_336mm-u-channel-green_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76012-rd",
    "name": "336mm U-Channel (Red)",
    "sku": "76012-rd",
    "category": "Robot Parts",
    "description": "336mm U-Channel (Red) · $13.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/336mm-u-channel-red",
    "imageUrl": "https://www.studica.com/images/thumbs/0016601_336mm-u-channel-red_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76012gp",
    "name": "336mm U-Channel",
    "sku": "76012GP",
    "category": "Robot Parts",
    "description": "336mm U-Channel · price not listed · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 336mm U-Channel, available in six different colors, is 3mm thick and has a 48mm x 48mm profile. As with the other Studica Robotics building components, it has the common hole pattern which makes it easy to connect to other structure with very little or no additional machining required. T hese anodized, deburred and polished pieces are strong and safe to work with. Note: Our new colors are now in stock !",
    "productUrl": "https://www.studica.com/336mm-u-channel-3",
    "imageUrl": "https://www.studica.com/images/thumbs/0017961_336mm-u-channel_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76013",
    "name": "288mm U-Channel (Blue)",
    "sku": "76013",
    "category": "Robot Parts",
    "description": "288mm U-Channel (Blue) · $11.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/288mm-u-channel-blue-2",
    "imageUrl": "https://www.studica.com/images/thumbs/0017764_288mm-u-channel-blue_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76013-bk",
    "name": "288mm U-Channel (Black)",
    "sku": "76013-bk",
    "category": "Robot Parts",
    "description": "288mm U-Channel (Black) · $11.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/288mm-u-channel-black",
    "imageUrl": "https://www.studica.com/images/thumbs/0017354_288mm-u-channel-black_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76013-cl",
    "name": "288mm U-Channel (Silver)",
    "sku": "76013-cl",
    "category": "Robot Parts",
    "description": "288mm U-Channel (Silver) · $10.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/288mm-u-channel-clear",
    "imageUrl": "https://www.studica.com/images/thumbs/0017350_288mm-u-channel-silver_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76013-gd",
    "name": "288mm U-Channel (Gold)",
    "sku": "76013-gd",
    "category": "Robot Parts",
    "description": "288mm U-Channel (Gold) · $11.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/288mm-u-channel-gold-2",
    "imageUrl": "https://www.studica.com/images/thumbs/0017351_288mm-u-channel-gold_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76013-gn",
    "name": "288mm U-Channel (Green)",
    "sku": "76013-gn",
    "category": "Robot Parts",
    "description": "288mm U-Channel (Green) · $11.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/288mm-u-channel-green",
    "imageUrl": "https://www.studica.com/images/thumbs/0017352_288mm-u-channel-green_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76013-rd",
    "name": "288mm U-Channel (Red)",
    "sku": "76013-rd",
    "category": "Robot Parts",
    "description": "288mm U-Channel (Red) · $11.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/288mm-u-channel-red",
    "imageUrl": "https://www.studica.com/images/thumbs/0017353_288mm-u-channel-red_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76013gp",
    "name": "288mm U-Channel",
    "sku": "76013GP",
    "category": "Robot Parts",
    "description": "288mm U-Channel · price not listed · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 288mm U-Channel is 3mm thick, has a 48mm x 48mm profile, and is part of our colored structure collection . As with the other Studica Robotics building components, it has the common hole pattern which makes it easy to connect to other structure with very little or no additional machining required. T hese anodized, deburred and polished pieces are strong and safe to work with. Note: Our new color structure components (red, green, blue, silver, gold, and black) are now in stock",
    "productUrl": "https://www.studica.com/288mm-u-channel-2-pack-2",
    "imageUrl": "https://www.studica.com/images/thumbs/0017957_288mm-u-channel_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76014",
    "name": "240mm U-Channel (Blue)",
    "sku": "76014",
    "category": "Robot Parts",
    "description": "240mm U-Channel (Blue) · $10.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/240mm-u-channel-blue",
    "imageUrl": "https://www.studica.com/images/thumbs/0017337_240mm-u-channel-blue_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76014-bk",
    "name": "240mm U-Channel (Black)",
    "sku": "76014-bk",
    "category": "Robot Parts",
    "description": "240mm U-Channel (Black) · $10.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/240mm-u-channel-black",
    "imageUrl": "https://www.studica.com/images/thumbs/0017342_240mm-u-channel-black_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76014-cl",
    "name": "240mm U-Channel (Silver)",
    "sku": "76014-cl",
    "category": "Robot Parts",
    "description": "240mm U-Channel (Silver) · $9.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/240mm-u-channel-clear",
    "imageUrl": "https://www.studica.com/images/thumbs/0017338_240mm-u-channel-silver_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76014-gd",
    "name": "240mm U-Channel (Gold)",
    "sku": "76014-gd",
    "category": "Robot Parts",
    "description": "240mm U-Channel (Gold) · $10.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/240mm-u-channel-gold",
    "imageUrl": "https://www.studica.com/images/thumbs/0017339_240mm-u-channel-gold_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76014-gn",
    "name": "240mm U-Channel (Green)",
    "sku": "76014-gn",
    "category": "Robot Parts",
    "description": "240mm U-Channel (Green) · $10.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/240mm-u-channel-green",
    "imageUrl": "https://www.studica.com/images/thumbs/0017340_240mm-u-channel-green_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76014-rd",
    "name": "240mm U-Channel (Red)",
    "sku": "76014-rd",
    "category": "Robot Parts",
    "description": "240mm U-Channel (Red) · $10.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/240mm-u-channel-red",
    "imageUrl": "https://www.studica.com/images/thumbs/0017341_240mm-u-channel-red_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76014gp",
    "name": "240mm U-Channel",
    "sku": "76014GP",
    "category": "Robot Parts",
    "description": "240mm U-Channel · price not listed · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 240mm U-Channel, available in six different colors, is 3mm thick and has a 48mm x 48mm profile. As with the other Studica Robotics building components, it has the common hole pattern which makes it easy to connect to other structure with very little or no additional machining required. T hese anodized, deburred and polished pieces are strong and safe to work with. Note: Our new colors are now in stock !",
    "productUrl": "https://www.studica.com/240mm-u-channel-3",
    "imageUrl": "https://www.studica.com/images/thumbs/0018022_240mm-u-channel_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76015",
    "name": "192mm U-Channel (Blue)",
    "sku": "76015",
    "category": "Robot Parts",
    "description": "192mm U-Channel (Blue) · $8.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/192mm-u-channel-blue",
    "imageUrl": "https://www.studica.com/images/thumbs/0017325_192mm-u-channel-blue_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76015-bk",
    "name": "192mm U-Channel (Black)",
    "sku": "76015-bk",
    "category": "Robot Parts",
    "description": "192mm U-Channel (Black) · $8.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/192mm-u-channel-black",
    "imageUrl": "https://www.studica.com/images/thumbs/0017330_192mm-u-channel-black_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76015-cl",
    "name": "192mm U-Channel (Silver)",
    "sku": "76015-cl",
    "category": "Robot Parts",
    "description": "192mm U-Channel (Silver) · $7.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/192mm-u-channel-clear",
    "imageUrl": "https://www.studica.com/images/thumbs/0017326_192mm-u-channel-silver_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76015-gd",
    "name": "192mm U-Channel (Gold)",
    "sku": "76015-gd",
    "category": "Robot Parts",
    "description": "192mm U-Channel (Gold) · $8.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/192mm-u-channel-gold",
    "imageUrl": "https://www.studica.com/images/thumbs/0017327_192mm-u-channel-gold_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76015-gn",
    "name": "192mm U-Channel (Green)",
    "sku": "76015-gn",
    "category": "Robot Parts",
    "description": "192mm U-Channel (Green) · $8.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/192mm-u-channel-green",
    "imageUrl": "https://www.studica.com/images/thumbs/0017328_192mm-u-channel-green_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76015-rd",
    "name": "192mm U-Channel (Red)",
    "sku": "76015-rd",
    "category": "Robot Parts",
    "description": "192mm U-Channel (Red) · $8.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/192mm-u-channel-red",
    "imageUrl": "https://www.studica.com/images/thumbs/0017329_192mm-u-channel-red_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76015gp",
    "name": "192mm U-Channel",
    "sku": "76015GP",
    "category": "Robot Parts",
    "description": "192mm U-Channel · price not listed · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 192mm U-Channel, available in six different colors, is 3mm thick and has a 48mm x 48mm profile. As with the other Studica Robotics building components, it has the common hole pattern which makes it easy to connect to other structure with very little or no additional machining required. You can easily connect to other channel, extrusions, bushings, bearing, mounting brackets and more so you can quickly assemble and disassemble robots and automated systems. T hese anodized, de",
    "productUrl": "https://www.studica.com/192mm-u-channel-3",
    "imageUrl": "https://www.studica.com/images/thumbs/0018033_192mm-u-channel_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76016",
    "name": "144mm U-Channel (Blue)",
    "sku": "76016",
    "category": "Robot Parts",
    "description": "144mm U-Channel (Blue) · $7.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/144mm-u-channel-blue-2",
    "imageUrl": "https://www.studica.com/images/thumbs/0017758_144mm-u-channel-blue_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76016-bk",
    "name": "144mm U-Channel (Black)",
    "sku": "76016-bk",
    "category": "Robot Parts",
    "description": "144mm U-Channel (Black) · $7.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/144mm-u-channel-black",
    "imageUrl": "https://www.studica.com/images/thumbs/0017318_144mm-u-channel-black_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76016-cl",
    "name": "144mm U-Channel (Silver)",
    "sku": "76016-cl",
    "category": "Robot Parts",
    "description": "144mm U-Channel (Silver) · $6.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/144mm-u-channel-clear",
    "imageUrl": "https://www.studica.com/images/thumbs/0017314_144mm-u-channel-silver_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76016-gd",
    "name": "144mm U-Channel (Gold)",
    "sku": "76016-gd",
    "category": "Robot Parts",
    "description": "144mm U-Channel (Gold) · $7.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/144mm-u-channel-gold",
    "imageUrl": "https://www.studica.com/images/thumbs/0017315_144mm-u-channel-gold_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76016-gn",
    "name": "144mm U-Channel (Green)",
    "sku": "76016-gn",
    "category": "Robot Parts",
    "description": "144mm U-Channel (Green) · $7.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/144mm-u-channel-green",
    "imageUrl": "https://www.studica.com/images/thumbs/0017316_144mm-u-channel-green_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76016-rd",
    "name": "144mm U-Channel (Red)",
    "sku": "76016-rd",
    "category": "Robot Parts",
    "description": "144mm U-Channel (Red) · $7.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/144mm-u-channel-red-2",
    "imageUrl": "https://www.studica.com/images/thumbs/0017317_144mm-u-channel-red_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76016gp",
    "name": "144mm U-Channel",
    "sku": "76016GP",
    "category": "Robot Parts",
    "description": "144mm U-Channel · price not listed · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 144mm U-Channel, available in six different colors, is 3mm thick and has a 48mm x 48mm profile. As with the other Studica Robotics building components, it has the common hole pattern which makes it easy to connect to other structure with very little or no additional machining required. You can easily connect to other channel, extrusions, bushings, bearing, mounting brackets and more so you can quickly assemble and disassemble robots and automated systems. T hese anodized, de",
    "productUrl": "https://www.studica.com/144mm-u-channel-2-pack-2",
    "imageUrl": "https://www.studica.com/images/thumbs/0018051_144mm-u-channel_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76017",
    "name": "96mm U-Channel (Blue)",
    "sku": "76017",
    "category": "Robot Parts",
    "description": "96mm U-Channel (Blue) · $5.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/96mm-u-channel-blue-2",
    "imageUrl": "https://www.studica.com/images/thumbs/0017770_96mm-u-channel-blue_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76017-bk",
    "name": "96mm U-Channel (Black)",
    "sku": "76017-bk",
    "category": "Robot Parts",
    "description": "96mm U-Channel (Black) · $5.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/96mm-u-channel-black",
    "imageUrl": "https://www.studica.com/images/thumbs/0017402_96mm-u-channel-black_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76017-cl",
    "name": "96mm U-Channel (Silver)",
    "sku": "76017-cl",
    "category": "Robot Parts",
    "description": "96mm U-Channel (Silver) · $4.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/96mm-u-channel-clear",
    "imageUrl": "https://www.studica.com/images/thumbs/0017398_96mm-u-channel-silver_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76017-gd",
    "name": "96mm U-Channel (Gold)",
    "sku": "76017-gd",
    "category": "Robot Parts",
    "description": "96mm U-Channel (Gold) · $5.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/96mm-u-channel-gold",
    "imageUrl": "https://www.studica.com/images/thumbs/0017399_96mm-u-channel-gold_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76017-gn",
    "name": "96mm U-Channel (Green)",
    "sku": "76017-gn",
    "category": "Robot Parts",
    "description": "96mm U-Channel (Green) · $5.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/96mm-u-channel-green",
    "imageUrl": "https://www.studica.com/images/thumbs/0017400_96mm-u-channel-green_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76017-rd",
    "name": "96mm U-Channel (Red)",
    "sku": "76017-rd",
    "category": "Robot Parts",
    "description": "96mm U-Channel (Red) · $5.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/96mm-u-channel-red",
    "imageUrl": "https://www.studica.com/images/thumbs/0017401_96mm-u-channel-red_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76017gp",
    "name": "96mm U-Channel",
    "sku": "76017GP",
    "category": "Robot Parts",
    "description": "96mm U-Channel · price not listed · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 96mm U-Channel, available in six different colors, is 3mm thick and has a 48mm x 48mm profile. As with the other Studica Robotics building components, it has the common hole pattern which makes it easy to connect to other structure with very little or no additional machining required. You can easily connect to other channel, extrusions, bushings, bearing, mounting brackets and more so you can quickly assemble and disassemble robots and automated systems. T hese anodized, deb",
    "productUrl": "https://www.studica.com/96mm-u-channel-2",
    "imageUrl": "https://www.studica.com/images/thumbs/0017993_96mm-u-channel_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76018",
    "name": "48mm U-Channel (Blue)",
    "sku": "76018",
    "category": "Robot Parts",
    "description": "48mm U-Channel (Blue) · $3.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/48mm-u-channel-blue-2",
    "imageUrl": "https://www.studica.com/images/thumbs/0017766_48mm-u-channel-blue_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76018-bk",
    "name": "48mm U-Channel (Black)",
    "sku": "76018-bk",
    "category": "Robot Parts",
    "description": "48mm U-Channel (Black) · $3.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/48mm-u-channel-black",
    "imageUrl": "https://www.studica.com/images/thumbs/0017390_48mm-u-channel-black_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76018-cl",
    "name": "48mm U-Channel (Silver)",
    "sku": "76018-cl",
    "category": "Robot Parts",
    "description": "48mm U-Channel (Silver) · $2.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/48mm-u-channel-clear",
    "imageUrl": "https://www.studica.com/images/thumbs/0017386_48mm-u-channel-silver_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76018-gd",
    "name": "48mm U-Channel (Gold)",
    "sku": "76018-gd",
    "category": "Robot Parts",
    "description": "48mm U-Channel (Gold) · $3.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/48mm-u-channel-gold",
    "imageUrl": "https://www.studica.com/images/thumbs/0017387_48mm-u-channel-gold_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76018-gn",
    "name": "48mm U-Channel (Green)",
    "sku": "76018-gn",
    "category": "Robot Parts",
    "description": "48mm U-Channel (Green) · $3.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/48mm-u-channel-green",
    "imageUrl": "https://www.studica.com/images/thumbs/0017388_48mm-u-channel-green_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76018-rd",
    "name": "48mm U-Channel (Red)",
    "sku": "76018-rd",
    "category": "Robot Parts",
    "description": "48mm U-Channel (Red) · $3.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/48mm-u-channel-red",
    "imageUrl": "https://www.studica.com/images/thumbs/0017389_48mm-u-channel-red_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76018gp",
    "name": "48mm U-Channel",
    "sku": "76018GP",
    "category": "Robot Parts",
    "description": "48mm U-Channel · price not listed · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics U-Channel, available in six different colors, is 3mm thick and has a 48mm x 48mm profile. As with the other Studica Robotics building components, it has the common hole pattern which makes it easy to connect to other structure with very little or no additional machining required. You can easily connect to other channel, extrusions, bushings, bearing, mounting brackets and more so you can quickly assemble and disassemble robots and automated systems. T hese anodized, deburred",
    "productUrl": "https://www.studica.com/48mm-u-channel-2-pack-2",
    "imageUrl": "https://www.studica.com/images/thumbs/0017982_48mm-u-channel_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76025",
    "name": "432mm Low Profile U-Channel (Blue)",
    "sku": "76025",
    "category": "Robot Parts",
    "description": "432mm Low Profile U-Channel (Blue) · $17.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/432mm-low-profile-u-channel-blue",
    "imageUrl": "https://www.studica.com/images/thumbs/0017241_432mm-low-profile-u-channel-blue_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76025-bk",
    "name": "432mm Low Profile U-Channel (Black)",
    "sku": "76025-bk",
    "category": "Robot Parts",
    "description": "432mm Low Profile U-Channel (Black) · $17.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/432mm-low-profile-u-channel-black",
    "imageUrl": "https://www.studica.com/images/thumbs/0017246_432mm-low-profile-u-channel-black_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76025-cl",
    "name": "432mm Low Profile U-Channel (Silver)",
    "sku": "76025-cl",
    "category": "Robot Parts",
    "description": "432mm Low Profile U-Channel (Silver) · $12.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/432mm-low-profile-u-channel-clear",
    "imageUrl": "https://www.studica.com/images/thumbs/0017242_432mm-low-profile-u-channel-silver_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76025-gd",
    "name": "432mm Low Profile U-Channel (Gold)",
    "sku": "76025-gd",
    "category": "Robot Parts",
    "description": "432mm Low Profile U-Channel (Gold) · $17.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/432mm-low-profile-u-channel-gold",
    "imageUrl": "https://www.studica.com/images/thumbs/0017243_432mm-low-profile-u-channel-gold_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76025-gn",
    "name": "432mm Low Profile U-Channel (Green)",
    "sku": "76025-gn",
    "category": "Robot Parts",
    "description": "432mm Low Profile U-Channel (Green) · $17.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/432mm-low-profile-u-channel-green",
    "imageUrl": "https://www.studica.com/images/thumbs/0017244_432mm-low-profile-u-channel-green_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76025-rd",
    "name": "432mm Low Profile U-Channel (Red)",
    "sku": "76025-rd",
    "category": "Robot Parts",
    "description": "432mm Low Profile U-Channel (Red) · $17.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/432mm-low-profile-u-channel-red",
    "imageUrl": "https://www.studica.com/images/thumbs/0017245_432mm-low-profile-u-channel-red_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76025gp",
    "name": "432mm Low Profile U-Channel",
    "sku": "76025GP",
    "category": "Robot Parts",
    "description": "432mm Low Profile U-Channel · price not listed · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 432mm Low Profile U-Channel, available in six different colors, is 3mm thick and has a 48mm x 14mm profile. As with the other Studica Robotics building components, it has the common hole pattern which makes it easy to connect to other structure with very little or no additional machining required. T hese anodized, deburred and polished pieces are strong and safe to work with. Note: Our new colors are now in stock !",
    "productUrl": "https://www.studica.com/432mm-low-profile-u-channel-3",
    "imageUrl": "https://www.studica.com/images/thumbs/0017970_432mm-low-profile-u-channel_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76026",
    "name": "384mm Low Profile U-Channel (Blue)",
    "sku": "76026",
    "category": "Robot Parts",
    "description": "384mm Low Profile U-Channel (Blue) · $16.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/384mm-low-profile-u-channel-blue",
    "imageUrl": "https://www.studica.com/images/thumbs/0017229_384mm-low-profile-u-channel-blue_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76026-bk",
    "name": "384mm Low Profile U-Channel (Black)",
    "sku": "76026-bk",
    "category": "Robot Parts",
    "description": "384mm Low Profile U-Channel (Black) · $16.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/384mm-low-profile-u-channel-black-2",
    "imageUrl": "https://www.studica.com/images/thumbs/0017234_384mm-low-profile-u-channel-black_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76026-cl",
    "name": "384mm Low Profile U-Channel (Silver)",
    "sku": "76026-cl",
    "category": "Robot Parts",
    "description": "384mm Low Profile U-Channel (Silver) · $11.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/384mm-low-profile-u-channel-clear",
    "imageUrl": "https://www.studica.com/images/thumbs/0017230_384mm-low-profile-u-channel-silver_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76026-gd",
    "name": "384mm Low Profile U-Channel (Gold)",
    "sku": "76026-gd",
    "category": "Robot Parts",
    "description": "384mm Low Profile U-Channel (Gold) · $16.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/384mm-low-profile-u-channel-gold",
    "imageUrl": "https://www.studica.com/images/thumbs/0017231_384mm-low-profile-u-channel-gold_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76026-gn",
    "name": "384mm Low Profile U-Channel (Green)",
    "sku": "76026-gn",
    "category": "Robot Parts",
    "description": "384mm Low Profile U-Channel (Green) · $16.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/384mm-low-profile-u-channel-green",
    "imageUrl": "https://www.studica.com/images/thumbs/0017232_384mm-low-profile-u-channel-green_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76026-rd",
    "name": "384mm Low Profile U-Channel (Red)",
    "sku": "76026-rd",
    "category": "Robot Parts",
    "description": "384mm Low Profile U-Channel (Red) · $16.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/384mm-low-profile-u-channel-red",
    "imageUrl": "https://www.studica.com/images/thumbs/0017233_384mm-low-profile-u-channel-red_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76026gp",
    "name": "384mm Low Profile U-Channel",
    "sku": "76026GP",
    "category": "Robot Parts",
    "description": "384mm Low Profile U-Channel · price not listed · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 384mm Low Profile U-Channel, available in six different colors is 3mm thick and has a 48mm x 14mm profile. T hese anodized, deburred and polished pieces are strong and safe to work with. Note: Our new colors are now in stock !",
    "productUrl": "https://www.studica.com/384mm-low-profile-u-channel-3",
    "imageUrl": "https://www.studica.com/images/thumbs/0017967_384mm-low-profile-u-channel_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76027",
    "name": "336mm Low Profile U-Channel (Blue)",
    "sku": "76027",
    "category": "Robot Parts",
    "description": "336mm Low Profile U-Channel (Blue) · $14.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/336mm-low-profile-u-channel-blue",
    "imageUrl": "https://www.studica.com/images/thumbs/0017217_336mm-low-profile-u-channel-blue_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76027-bk",
    "name": "336mm Low Profile U-Channel (Black)",
    "sku": "76027-bk",
    "category": "Robot Parts",
    "description": "336mm Low Profile U-Channel (Black) · $14.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/336mm-low-profile-u-channel-black",
    "imageUrl": "https://www.studica.com/images/thumbs/0017222_336mm-low-profile-u-channel-black_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76027-cl",
    "name": "336mm Low Profile U-Channel (Silver)",
    "sku": "76027-cl",
    "category": "Robot Parts",
    "description": "336mm Low Profile U-Channel (Silver) · $10.29 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/336mm-low-profile-u-channel-clear",
    "imageUrl": "https://www.studica.com/images/thumbs/0017218_336mm-low-profile-u-channel-silver_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76027-gd",
    "name": "336mm Low Profile U-Channel (Gold)",
    "sku": "76027-gd",
    "category": "Robot Parts",
    "description": "336mm Low Profile U-Channel (Gold) · $14.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/336mm-low-profile-u-channel-gold",
    "imageUrl": "https://www.studica.com/images/thumbs/0017219_336mm-low-profile-u-channel-gold_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76027-gn",
    "name": "336mm Low Profile U-Channel (Green)",
    "sku": "76027-gn",
    "category": "Robot Parts",
    "description": "336mm Low Profile U-Channel (Green) · $14.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/336mm-low-profile-u-channel-green-2",
    "imageUrl": "https://www.studica.com/images/thumbs/0017220_336mm-low-profile-u-channel-green_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76027-rd",
    "name": "336mm Low Profile U-Channel (Red)",
    "sku": "76027-rd",
    "category": "Robot Parts",
    "description": "336mm Low Profile U-Channel (Red) · $14.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/336mm-low-profile-u-channel-red",
    "imageUrl": "https://www.studica.com/images/thumbs/0017221_336mm-low-profile-u-channel-red_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76027gp",
    "name": "336mm Low Profile U-Channel",
    "sku": "76027GP",
    "category": "Robot Parts",
    "description": "336mm Low Profile U-Channel · price not listed · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 336mm Low Profile U-Channel, available in six different colors, is 3mm thick and has a 48mm x 14mm profile. T hese anodized, deburred and polished pieces are strong and safe to work with. Note: Our new colors are now in stock !",
    "productUrl": "https://www.studica.com/336mm-low-profile-u-channel-3",
    "imageUrl": "https://www.studica.com/images/thumbs/0017960_336mm-low-profile-u-channel_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76028",
    "name": "288mm Low Profile U-Channel (Blue)",
    "sku": "76028",
    "category": "Robot Parts",
    "description": "288mm Low Profile U-Channel (Blue) · $12.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/288mm-low-profile-u-channel-blue-2",
    "imageUrl": "https://www.studica.com/images/thumbs/0017763_288mm-low-profile-u-channel-blue_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76028-bk",
    "name": "288mm Low Profile U-Channel (Black)",
    "sku": "76028-bk",
    "category": "Robot Parts",
    "description": "288mm Low Profile U-Channel (Black) · $12.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/288mm-low-profile-u-channel-black",
    "imageUrl": "https://www.studica.com/images/thumbs/0017210_288mm-low-profile-u-channel-black_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76028-cl",
    "name": "288mm Low Profile U-Channel (Silver)",
    "sku": "76028-cl",
    "category": "Robot Parts",
    "description": "288mm Low Profile U-Channel (Silver) · $9.29 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/288mm-low-profile-u-channel-clear",
    "imageUrl": "https://www.studica.com/images/thumbs/0017206_288mm-low-profile-u-channel-silver_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76028-gd",
    "name": "288mm Low Profile U-Channel (Gold)",
    "sku": "76028-gd",
    "category": "Robot Parts",
    "description": "288mm Low Profile U-Channel (Gold) · $12.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/288mm-low-profile-u-channel-gold",
    "imageUrl": "https://www.studica.com/images/thumbs/0017207_288mm-low-profile-u-channel-gold_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76028-gn",
    "name": "288mm Low Profile U-Channel (Green)",
    "sku": "76028-gn",
    "category": "Robot Parts",
    "description": "288mm Low Profile U-Channel (Green) · $12.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/288mm-low-profile-u-channel-green",
    "imageUrl": "https://www.studica.com/images/thumbs/0017208_288mm-low-profile-u-channel-green_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76028-rd",
    "name": "288mm Low Profile U-Channel (Red)",
    "sku": "76028-rd",
    "category": "Robot Parts",
    "description": "288mm Low Profile U-Channel (Red) · $12.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/288mm-low-profile-u-channel-red",
    "imageUrl": "https://www.studica.com/images/thumbs/0017209_288mm-low-profile-u-channel-red_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76028gp",
    "name": "288mm Low Profile U-Channel",
    "sku": "76028GP",
    "category": "Robot Parts",
    "description": "288mm Low Profile U-Channel · price not listed · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 288mm Low Profile U-Channel is 3mm thick, has a 48mm x 14mm profile, and is part of our colored structure collection . As with the other Studica Robotics building components, it has the common hole pattern which makes it easy to connect to other structure with very little or no additional machining required. You can easily connect to other channel, extrusions, bushings, bearing, mounting brackets and more so you can quickly assemble and disassemble robots and automated syste",
    "productUrl": "https://www.studica.com/288mm-low-profile-u-channel-2-pack-2",
    "imageUrl": "https://www.studica.com/images/thumbs/0017956_288mm-low-profile-u-channel_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76029",
    "name": "240mm Low Profile U-Channel (Blue)",
    "sku": "76029",
    "category": "Robot Parts",
    "description": "240mm Low Profile U-Channel (Blue) · $11.39 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/240mm-low-profile-u-channel-blue",
    "imageUrl": "https://www.studica.com/images/thumbs/0017193_240mm-low-profile-u-channel-blue_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76029-bk",
    "name": "240mm Low Profile U-Channel (Black)",
    "sku": "76029-bk",
    "category": "Robot Parts",
    "description": "240mm Low Profile U-Channel (Black) · $11.39 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/240mm-low-profile-u-channel-black",
    "imageUrl": "https://www.studica.com/images/thumbs/0017198_240mm-low-profile-u-channel-black_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76029-cl",
    "name": "240mm Low Profile U-Channel (Silver)",
    "sku": "76029-cl",
    "category": "Robot Parts",
    "description": "240mm Low Profile U-Channel (Silver) · $7.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/240mm-low-profile-u-channel-clear",
    "imageUrl": "https://www.studica.com/images/thumbs/0017194_240mm-low-profile-u-channel-silver_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76029-gd",
    "name": "240mm Low Profile U-Channel (Gold)",
    "sku": "76029-gd",
    "category": "Robot Parts",
    "description": "240mm Low Profile U-Channel (Gold) · $11.39 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/240mm-low-profile-u-channel-gold",
    "imageUrl": "https://www.studica.com/images/thumbs/0017195_240mm-low-profile-u-channel-gold_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76029-gn",
    "name": "240mm Low Profile U-Channel (Green)",
    "sku": "76029-gn",
    "category": "Robot Parts",
    "description": "240mm Low Profile U-Channel (Green) · $11.39 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/240mm-low-profile-u-channel-green",
    "imageUrl": "https://www.studica.com/images/thumbs/0017196_240mm-low-profile-u-channel-green_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76029-rd",
    "name": "240mm Low Profile U-Channel (Red)",
    "sku": "76029-rd",
    "category": "Robot Parts",
    "description": "240mm Low Profile U-Channel (Red) · $11.39 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/240mm-low-profile-u-channel-red",
    "imageUrl": "https://www.studica.com/images/thumbs/0017197_240mm-low-profile-u-channel-red_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76029gp",
    "name": "240mm Low Profile U-Channel",
    "sku": "76029GP",
    "category": "Robot Parts",
    "description": "240mm Low Profile U-Channel · price not listed · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 240mm Low Profile U-Channel, available in six different colors, is 3mm thick and has a 48mm x 14mm profile. As with the other Studica Robotics building components, it has the common hole pattern which makes it easy to connect to other structure with very little or no additional machining required. You can easily connect to other channel, extrusions, bushings, bearing, mounting brackets and more so you can quickly assemble and disassemble robots and automated systems. T hese ",
    "productUrl": "https://www.studica.com/240mm-low-profile-u-channel-3",
    "imageUrl": "https://www.studica.com/images/thumbs/0018024_240mm-low-profile-u-channel_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76030",
    "name": "192mm Low Profile U-Channel (Blue)",
    "sku": "76030",
    "category": "Robot Parts",
    "description": "192mm Low Profile U-Channel (Blue) · $9.79 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/192mm-low-profile-u-channel-blue",
    "imageUrl": "https://www.studica.com/images/thumbs/0017181_192mm-low-profile-u-channel-blue_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76030-bk",
    "name": "192mm Low Profile U-Channel (Black)",
    "sku": "76030-bk",
    "category": "Robot Parts",
    "description": "192mm Low Profile U-Channel (Black) · $9.79 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/192mm-low-profile-u-channel-black",
    "imageUrl": "https://www.studica.com/images/thumbs/0017186_192mm-low-profile-u-channel-black_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76030-cl",
    "name": "192mm Low Profile U-Channel (Silver)",
    "sku": "76030-cl",
    "category": "Robot Parts",
    "description": "192mm Low Profile U-Channel (Silver) · $6.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/192mm-low-profile-u-channel-clear",
    "imageUrl": "https://www.studica.com/images/thumbs/0017182_192mm-low-profile-u-channel-silver_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76030-gd",
    "name": "192mm Low Profile U-Channel (Gold)",
    "sku": "76030-gd",
    "category": "Robot Parts",
    "description": "192mm Low Profile U-Channel (Gold) · $9.79 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/192mm-low-profile-u-channel-gold",
    "imageUrl": "https://www.studica.com/images/thumbs/0017183_192mm-low-profile-u-channel-gold_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76030-gn",
    "name": "192mm Low Profile U-Channel (Green)",
    "sku": "76030-gn",
    "category": "Robot Parts",
    "description": "192mm Low Profile U-Channel (Green) · $9.79 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/192mm-low-profile-u-channel-green",
    "imageUrl": "https://www.studica.com/images/thumbs/0017184_192mm-low-profile-u-channel-green_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76030-rd",
    "name": "192mm Low Profile U-Channel (Red)",
    "sku": "76030-rd",
    "category": "Robot Parts",
    "description": "192mm Low Profile U-Channel (Red) · $9.79 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/192mm-low-profile-u-channel-red",
    "imageUrl": "https://www.studica.com/images/thumbs/0017185_192mm-low-profile-u-channel-red_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76030gp",
    "name": "192mm Low Profile U-Channel",
    "sku": "76030GP",
    "category": "Robot Parts",
    "description": "192mm Low Profile U-Channel · price not listed · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 192mm Low Profile U Channel, available in six different colors, is 3mm thick and has a 48mm x 14mm profile. As with the other Studica Robotics building components, it has the common hole pattern which makes it easy to connect to other structure with very little or no additional machining required. You can easily connect to other channel, extrusions, bushings, bearing, mounting brackets and more so you can quickly assemble and disassemble robots and automated systems. T hese ",
    "productUrl": "https://www.studica.com/192mm-low-profile-u-channel-3",
    "imageUrl": "https://www.studica.com/images/thumbs/0018035_192mm-low-profile-u-channel_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76031",
    "name": "144mm Low Profile U-Channel (Blue)",
    "sku": "76031",
    "category": "Robot Parts",
    "description": "144mm Low Profile U-Channel (Blue) · $7.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/144mm-low-profile-u-channel-blue",
    "imageUrl": "https://www.studica.com/images/thumbs/0017169_144mm-low-profile-u-channel-blue_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76031-bk",
    "name": "144mm Low Profile U-Channel (Black)",
    "sku": "76031-bk",
    "category": "Robot Parts",
    "description": "144mm Low Profile U-Channel (Black) · $7.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/144mm-low-profile-u-channel-black",
    "imageUrl": "https://www.studica.com/images/thumbs/0017174_144mm-low-profile-u-channel-black_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76031-cl",
    "name": "144mm Low Profile U-Channel (Silver)",
    "sku": "76031-cl",
    "category": "Robot Parts",
    "description": "144mm Low Profile U-Channel (Silver) · $5.19 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/144mm-low-profile-u-channel-clear",
    "imageUrl": "https://www.studica.com/images/thumbs/0017170_144mm-low-profile-u-channel-silver_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76031-gd",
    "name": "144mm Low Profile U-Channel (Gold)",
    "sku": "76031-gd",
    "category": "Robot Parts",
    "description": "144mm Low Profile U-Channel (Gold) · $7.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/144mm-low-profile-u-channel-gold",
    "imageUrl": "https://www.studica.com/images/thumbs/0017171_144mm-low-profile-u-channel-gold_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76031-gn",
    "name": "144mm Low Profile U-Channel (Green)",
    "sku": "76031-gn",
    "category": "Robot Parts",
    "description": "144mm Low Profile U-Channel (Green) · $7.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/144mm-low-profile-u-channel-green",
    "imageUrl": "https://www.studica.com/images/thumbs/0017172_144mm-low-profile-u-channel-green_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76031-rd",
    "name": "144mm Low Profile U-Channel (Red)",
    "sku": "76031-rd",
    "category": "Robot Parts",
    "description": "144mm Low Profile U-Channel (Red) · $7.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/144mm-low-profile-u-channel-red",
    "imageUrl": "https://www.studica.com/images/thumbs/0017173_144mm-low-profile-u-channel-red_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76031gp",
    "name": "144mm Low Profile U-Channel",
    "sku": "76031GP",
    "category": "Robot Parts",
    "description": "144mm Low Profile U-Channel · price not listed · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 144mm Low Profile U-Channel, available in six different colors, is 3mm thick and has a 48mm x 14mm profile. As with the other Studica Robotics building components, it has the common hole pattern which makes it easy to connect to other structure with very little or no additional machining required. You can easily connect to other channel, extrusions, bushings, bearing, mounting brackets and more so you can quickly assemble and disassemble robots and automated systems. T hese ",
    "productUrl": "https://www.studica.com/144mm-low-profile-u-channel-2",
    "imageUrl": "https://www.studica.com/images/thumbs/0018049_144mm-low-profile-u-channel_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76032-bk",
    "name": "96mm Low Profile U-Channel (Black)",
    "sku": "76032-bk",
    "category": "Robot Parts",
    "description": "96mm Low Profile U-Channel (Black) · $6.59 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/96mm-low-profile-u-channel-black",
    "imageUrl": "https://www.studica.com/images/thumbs/0017270_96mm-low-profile-u-channel-black_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76032-bl",
    "name": "96mm Low Profile U-Channel (Blue)",
    "sku": "76032-bl",
    "category": "Robot Parts",
    "description": "96mm Low Profile U-Channel (Blue) · $6.59 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/96mm-low-profile-u-channel-blue",
    "imageUrl": "https://www.studica.com/images/thumbs/0017265_96mm-low-profile-u-channel-blue_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76032-cl",
    "name": "96mm Low Profile U-Channel (Silver)",
    "sku": "76032-cl",
    "category": "Robot Parts",
    "description": "96mm Low Profile U-Channel (Silver) · $3.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/96mm-low-profile-u-channel-clear",
    "imageUrl": "https://www.studica.com/images/thumbs/0017266_96mm-low-profile-u-channel-silver_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76032-gd",
    "name": "96mm Low Profile U-Channel (Gold)",
    "sku": "76032-gd",
    "category": "Robot Parts",
    "description": "96mm Low Profile U-Channel (Gold) · $6.59 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/96mm-low-profile-u-channel-gold",
    "imageUrl": "https://www.studica.com/images/thumbs/0017267_96mm-low-profile-u-channel-gold_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76032-gn",
    "name": "96mm Low Profile U-Channel (Green)",
    "sku": "76032-gn",
    "category": "Robot Parts",
    "description": "96mm Low Profile U-Channel (Green) · $6.59 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/96mm-low-profile-u-channel-green",
    "imageUrl": "https://www.studica.com/images/thumbs/0017268_96mm-low-profile-u-channel-green_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76032-rd",
    "name": "96mm Low Profile U-Channel (Red)",
    "sku": "76032-rd",
    "category": "Robot Parts",
    "description": "96mm Low Profile U-Channel (Red) · $6.59 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/96mm-low-profile-u-channel-red",
    "imageUrl": "https://www.studica.com/images/thumbs/0017269_96mm-low-profile-u-channel-red_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76032gp",
    "name": "96mm Low Profile U-Channel",
    "sku": "76032GP",
    "category": "Robot Parts",
    "description": "96mm Low Profile U-Channel · price not listed · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 96mm Low Profile U-Channel, available in six different colors, is 3mm thick and has a 48mm x 14mm profile. As with the other Studica Robotics building components, it has the common hole pattern which makes it easy to connect to other structure with very little or no additional machining required. T hese anodized, deburred and polished pieces are strong and safe to work with. Note: Our new colors are now in stock !",
    "productUrl": "https://www.studica.com/96mm-low-profile-u-channel-3",
    "imageUrl": "https://www.studica.com/images/thumbs/0017989_96mm-low-profile-u-channel_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76033",
    "name": "48mm Low Profile U-Channel (Blue)",
    "sku": "76033",
    "category": "Robot Parts",
    "description": "48mm Low Profile U-Channel (Blue) · $4.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/48mm-low-profile-u-channel-blue",
    "imageUrl": "https://www.studica.com/images/thumbs/0017253_48mm-low-profile-u-channel-blue_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76033-bk",
    "name": "48mm Low Profile U-Channel (Black)",
    "sku": "76033-bk",
    "category": "Robot Parts",
    "description": "48mm Low Profile U-Channel (Black) · $4.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/48mm-low-profile-u-channel-black",
    "imageUrl": "https://www.studica.com/images/thumbs/0017258_48mm-low-profile-u-channel-black_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76033-cl",
    "name": "48mm Low Profile U-Channel (Silver)",
    "sku": "76033-cl",
    "category": "Robot Parts",
    "description": "48mm Low Profile U-Channel (Silver) · $2.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/48mm-low-profile-u-channel-clear",
    "imageUrl": "https://www.studica.com/images/thumbs/0017254_48mm-low-profile-u-channel-silver_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76033-gd",
    "name": "48mm Low Profile U-Channel (Gold)",
    "sku": "76033-gd",
    "category": "Robot Parts",
    "description": "48mm Low Profile U-Channel (Gold) · $4.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/48mm-low-profile-u-channel-gold",
    "imageUrl": "https://www.studica.com/images/thumbs/0017255_48mm-low-profile-u-channel-gold_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76033-gn",
    "name": "48mm Low Profile U-Channel (Green)",
    "sku": "76033-gn",
    "category": "Robot Parts",
    "description": "48mm Low Profile U-Channel (Green) · $4.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/48mm-low-profile-u-channel-green",
    "imageUrl": "https://www.studica.com/images/thumbs/0017256_48mm-low-profile-u-channel-green_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76033-rd",
    "name": "48mm Low Profile U-Channel (Red)",
    "sku": "76033-rd",
    "category": "Robot Parts",
    "description": "48mm Low Profile U-Channel (Red) · $4.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/48mm-low-profile-u-channel-red",
    "imageUrl": "https://www.studica.com/images/thumbs/0017257_48mm-low-profile-u-channel-red_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76033gp",
    "name": "48mm Low Profile U-Channel",
    "sku": "76033GP",
    "category": "Robot Parts",
    "description": "48mm Low Profile U-Channel · price not listed · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 48mm Low Profile U-Channel, available in six different colors, is 3mm thick and has a 48mm x 14mm profile. As with the other Studica Robotics building components, it has the common hole pattern which makes it easy to connect to other structure with very little or no additional machining required. You can easily connect to other channel, extrusions, bushings, bearing, mounting brackets and more so you can quickly assemble and disassemble robots and automated systems. These an",
    "productUrl": "https://www.studica.com/48mm-low-profile-u-channel-3",
    "imageUrl": "https://www.studica.com/images/thumbs/0017978_48mm-low-profile-u-channel_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76040",
    "name": "432mm Flat Beam (Blue)",
    "sku": "76040",
    "category": "Robot Parts",
    "description": "432mm Flat Beam (Blue) · $6.79 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/432mm-flat-beam-blue",
    "imageUrl": "https://www.studica.com/images/thumbs/0016932_432mm-flat-beam-blue_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76040-bk",
    "name": "432mm Flat Beam (Black)",
    "sku": "76040-bk",
    "category": "Robot Parts",
    "description": "432mm Flat Beam (Black) · $6.79 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/432mm-flat-beam-black",
    "imageUrl": "https://www.studica.com/images/thumbs/0016943_432mm-flat-beam-black_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76040-cl",
    "name": "432mm Flat Beam (Silver)",
    "sku": "76040-cl",
    "category": "Robot Parts",
    "description": "432mm Flat Beam (Silver) · $4.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/432mm-flat-beam-clear",
    "imageUrl": "https://www.studica.com/images/thumbs/0016939_432mm-flat-beam-silver_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76040-gd",
    "name": "432mm Flat Beam (Gold)",
    "sku": "76040-gd",
    "category": "Robot Parts",
    "description": "432mm Flat Beam (Gold) · $6.79 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/432mm-flat-beam-gold",
    "imageUrl": "https://www.studica.com/images/thumbs/0016940_432mm-flat-beam-gold_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76040-gn",
    "name": "432mm Flat Beam (Green)",
    "sku": "76040-gn",
    "category": "Robot Parts",
    "description": "432mm Flat Beam (Green) · $6.79 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/432mm-flat-beam-green",
    "imageUrl": "https://www.studica.com/images/thumbs/0016941_432mm-flat-beam-green_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76040-rd",
    "name": "432mm Flat Beam (Red)",
    "sku": "76040-rd",
    "category": "Robot Parts",
    "description": "432mm Flat Beam (Red) · $6.79 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/432mm-flat-beam-red",
    "imageUrl": "https://www.studica.com/images/thumbs/0016942_432mm-flat-beam-red_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76040gp",
    "name": "432mm Flat Beam",
    "sku": "76040GP",
    "category": "Robot Parts",
    "description": "432mm Flat Beam · price not listed · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 432mm Flat Beam is 3mm thick, 8mm wide, and part of our colored structure collection. As with the other Studica Robotics building components, it has the common hole pattern which makes it easy to connect to other structure with very little or no additional machining required. These anodized, deburred and polished pieces are strong and safe to work with. Note: Our new color structure components (red, green, blue, silver, gold, and black) are now in stock!",
    "productUrl": "https://www.studica.com/432mm-flat-beam-3",
    "imageUrl": "https://www.studica.com/images/thumbs/0017793_432mm-flat-beam_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76041",
    "name": "384mm Flat Beam (Blue)",
    "sku": "76041",
    "category": "Robot Parts",
    "description": "384mm Flat Beam (Blue) · $5.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/384mm-flat-beam-blue",
    "imageUrl": "https://www.studica.com/images/thumbs/0016921_384mm-flat-beam-blue_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76041-bk",
    "name": "384mm Flat Beam (Black)",
    "sku": "76041-bk",
    "category": "Robot Parts",
    "description": "384mm Flat Beam (Black) · $5.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/384mm-flat-beam-black",
    "imageUrl": "https://www.studica.com/images/thumbs/0016926_384mm-flat-beam-black_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76041-cl",
    "name": "384mm Flat Beam (Silver)",
    "sku": "76041-cl",
    "category": "Robot Parts",
    "description": "384mm Flat Beam (Silver) · $3.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/384mm-flat-beam-clear",
    "imageUrl": "https://www.studica.com/images/thumbs/0016922_384mm-flat-beam-silver_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76041-gd",
    "name": "384mm Flat Beam (Gold)",
    "sku": "76041-gd",
    "category": "Robot Parts",
    "description": "384mm Flat Beam (Gold) · $5.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/384mm-flat-beam-gold",
    "imageUrl": "https://www.studica.com/images/thumbs/0016923_384mm-flat-beam-gold_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76041-gn",
    "name": "384mm Flat Beam (Green)",
    "sku": "76041-gn",
    "category": "Robot Parts",
    "description": "384mm Flat Beam (Green) · $5.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/384mm-flat-beam-green",
    "imageUrl": "https://www.studica.com/images/thumbs/0016924_384mm-flat-beam-green_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76041-rd",
    "name": "384mm Flat Beam (Red)",
    "sku": "76041-rd",
    "category": "Robot Parts",
    "description": "384mm Flat Beam (Red) · $5.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/384mm-flat-beam-red",
    "imageUrl": "https://www.studica.com/images/thumbs/0016925_384mm-flat-beam-red_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76041gp",
    "name": "384mm Flat Beam",
    "sku": "76041GP",
    "category": "Robot Parts",
    "description": "384mm Flat Beam · price not listed · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 384mm Flat Beam is 3mm thick and 8mm wide, available in six different colors. As with the other Studica Robotics building components, it has the common hole pattern which makes it easy to connect to other structure with very little or no additional machining required. You can easily connect to other channel, extrusions, bushings, bearing, mounting brackets and more so you can quickly assemble and disassemble robots and automated systems. Ideal for rapid prototyping. These an",
    "productUrl": "https://www.studica.com/384mm-flat-beam-3",
    "imageUrl": "https://www.studica.com/images/thumbs/0018069_384mm-flat-beam_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76042",
    "name": "336mm Flat Beam (Blue)",
    "sku": "76042",
    "category": "Robot Parts",
    "description": "336mm Flat Beam (Blue) · $5.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/336mm-flat-beam-blue",
    "imageUrl": "https://www.studica.com/images/thumbs/0016909_336mm-flat-beam-blue_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76042-bk",
    "name": "336mm Flat Beam (Black)",
    "sku": "76042-bk",
    "category": "Robot Parts",
    "description": "336mm Flat Beam (Black) · $5.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/336mm-flat-beam-black",
    "imageUrl": "https://www.studica.com/images/thumbs/0016914_336mm-flat-beam-black_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76042-cl",
    "name": "336mm Flat Beam (Silver)",
    "sku": "76042-cl",
    "category": "Robot Parts",
    "description": "336mm Flat Beam (Silver) · $3.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/336mm-flat-beam-clear",
    "imageUrl": "https://www.studica.com/images/thumbs/0016910_336mm-flat-beam-silver_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76042-gd",
    "name": "336mm Flat Beam (Gold)",
    "sku": "76042-gd",
    "category": "Robot Parts",
    "description": "336mm Flat Beam (Gold) · $5.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/336mm-flat-beam-gold",
    "imageUrl": "https://www.studica.com/images/thumbs/0016911_336mm-flat-beam-gold_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76042-gn",
    "name": "336mm Flat Beam (Green)",
    "sku": "76042-gn",
    "category": "Robot Parts",
    "description": "336mm Flat Beam (Green) · $5.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/336mm-flat-beam-green",
    "imageUrl": "https://www.studica.com/images/thumbs/0016912_336mm-flat-beam-green_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76042-rd",
    "name": "336mm Flat Beam (Red)",
    "sku": "76042-rd",
    "category": "Robot Parts",
    "description": "336mm Flat Beam (Red) · $5.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/336mm-flat-beam-red",
    "imageUrl": "https://www.studica.com/images/thumbs/0016913_336mm-flat-beam-red_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76042gp",
    "name": "336mm Flat Beam",
    "sku": "76042GP",
    "category": "Robot Parts",
    "description": "336mm Flat Beam · price not listed · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 336mm Flat Beam is 3mm thick and 8mm wide, available in six colors. As with the other Studica Robotics building components, it has the common hole pattern which makes it easy to connect to other structure with very little or no additional machining required. You can easily connect to other channel, extrusions, bushings, bearing, mounting brackets and more so you can quickly assemble and disassemble robots and automated systems. Ideal for rapid prototyping. These anodized, de",
    "productUrl": "https://www.studica.com/336mm-flat-beam-3",
    "imageUrl": "https://www.studica.com/images/thumbs/0018070_336mm-flat-beam_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76043",
    "name": "288mm Flat Beam (Blue)",
    "sku": "76043",
    "category": "Robot Parts",
    "description": "288mm Flat Beam (Blue) · $4.89 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/288mm-flat-beam-blue-2",
    "imageUrl": "https://www.studica.com/images/thumbs/0017762_288mm-flat-beam-blue_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76043-bk",
    "name": "288mm Flat Beam (Black)",
    "sku": "76043-bk",
    "category": "Robot Parts",
    "description": "288mm Flat Beam (Black) · $4.89 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/288mm-flat-beam-black",
    "imageUrl": "https://www.studica.com/images/thumbs/0016902_288mm-flat-beam-black_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76043-cl",
    "name": "288mm Flat Beam (Silver)",
    "sku": "76043-cl",
    "category": "Robot Parts",
    "description": "288mm Flat Beam (Silver) · $2.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/288mm-flat-beam-clear",
    "imageUrl": "https://www.studica.com/images/thumbs/0016898_288mm-flat-beam-silver_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76043-gd",
    "name": "288mm Flat Beam (Gold)",
    "sku": "76043-gd",
    "category": "Robot Parts",
    "description": "288mm Flat Beam (Gold) · $4.89 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/288mm-flat-beam-gold",
    "imageUrl": "https://www.studica.com/images/thumbs/0016899_288mm-flat-beam-gold_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76043-gn",
    "name": "288mm Flat Beam (Green)",
    "sku": "76043-gn",
    "category": "Robot Parts",
    "description": "288mm Flat Beam (Green) · $4.89 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/288mm-flat-beam-green",
    "imageUrl": "https://www.studica.com/images/thumbs/0016900_288mm-flat-beam-green_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76043-rd",
    "name": "288mm Flat Beam (Red)",
    "sku": "76043-rd",
    "category": "Robot Parts",
    "description": "288mm Flat Beam (Red) · $4.89 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/288mm-flat-beam-red",
    "imageUrl": "https://www.studica.com/images/thumbs/0016901_288mm-flat-beam-red_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76043gp",
    "name": "288mm Flat Beam",
    "sku": "76043GP",
    "category": "Robot Parts",
    "description": "288mm Flat Beam · price not listed · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 288mm Flat Beam is 3mm thick and 8mm wide. Available in six different colors. These anodized, deburred and polished pieces are strong and safe to work with. Note: Our new colors are now in stock !",
    "productUrl": "https://www.studica.com/288mm-flat-beam-2-pack-2",
    "imageUrl": "https://www.studica.com/images/thumbs/0018071_288mm-flat-beam_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76044",
    "name": "240mm Flat Beam (Blue)",
    "sku": "76044",
    "category": "Robot Parts",
    "description": "240mm Flat Beam (Blue) · $3.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/240mm-flat-beam-blue",
    "imageUrl": "https://www.studica.com/images/thumbs/0016885_240mm-flat-beam-blue_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76044-bk",
    "name": "240mm Flat Beam (Black)",
    "sku": "76044-bk",
    "category": "Robot Parts",
    "description": "240mm Flat Beam (Black) · $3.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/240mm-flat-beam-black",
    "imageUrl": "https://www.studica.com/images/thumbs/0016890_240mm-flat-beam-black_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76044-cl",
    "name": "240mm Flat Beam (Silver)",
    "sku": "76044-cl",
    "category": "Robot Parts",
    "description": "240mm Flat Beam (Silver) · $2.89 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/240mm-flat-beam-clear",
    "imageUrl": "https://www.studica.com/images/thumbs/0016886_240mm-flat-beam-silver_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76044-gd",
    "name": "240mm Flat Beam (Gold)",
    "sku": "76044-gd",
    "category": "Robot Parts",
    "description": "240mm Flat Beam (Gold) · $3.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/240mm-flat-beam-gold",
    "imageUrl": "https://www.studica.com/images/thumbs/0016887_240mm-flat-beam-gold_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76044-gn",
    "name": "240mm Flat Beam (Green)",
    "sku": "76044-gn",
    "category": "Robot Parts",
    "description": "240mm Flat Beam (Green) · $3.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/240mm-flat-beam-green",
    "imageUrl": "https://www.studica.com/images/thumbs/0016888_240mm-flat-beam-green_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76044-rd",
    "name": "240mm Flat Beam (Red)",
    "sku": "76044-rd",
    "category": "Robot Parts",
    "description": "240mm Flat Beam (Red) · $3.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/240mm-flat-beam-red",
    "imageUrl": "https://www.studica.com/images/thumbs/0016889_240mm-flat-beam-red_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76044gp",
    "name": "240mm Flat Beam",
    "sku": "76044GP",
    "category": "Robot Parts",
    "description": "240mm Flat Beam · price not listed · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics Flat Beam is 3mm thick and 8mm wide, with a length of 240mm. Available in six different colors. These anodized, deburred and polished pieces are strong and safe to work with. Note: Our new colors are now in stock !",
    "productUrl": "https://www.studica.com/240mm-flat-beam-3",
    "imageUrl": "https://www.studica.com/images/thumbs/0018072_240mm-flat-beam_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76045",
    "name": "192mm Flat Beam (Blue)",
    "sku": "76045",
    "category": "Robot Parts",
    "description": "192mm Flat Beam (Blue) · $3.29 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/192mm-flat-beam-blue",
    "imageUrl": "https://www.studica.com/images/thumbs/0016873_192mm-flat-beam-blue_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76045-bk",
    "name": "192mm Flat Beam (Black)",
    "sku": "76045-bk",
    "category": "Robot Parts",
    "description": "192mm Flat Beam (Black) · $3.29 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/192mm-flat-beam-black",
    "imageUrl": "https://www.studica.com/images/thumbs/0016878_192mm-flat-beam-black_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76045-cl",
    "name": "192mm Flat Beam (Silver)",
    "sku": "76045-cl",
    "category": "Robot Parts",
    "description": "192mm Flat Beam (Silver) · $2.39 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/192mm-flat-beam-clear",
    "imageUrl": "https://www.studica.com/images/thumbs/0016874_192mm-flat-beam-silver_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76045-gd",
    "name": "192mm Flat Beam (Gold)",
    "sku": "76045-gd",
    "category": "Robot Parts",
    "description": "192mm Flat Beam (Gold) · $3.29 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/192mm-flat-beam-gold",
    "imageUrl": "https://www.studica.com/images/thumbs/0016875_192mm-flat-beam-gold_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76045-gn",
    "name": "192mm Flat Beam (Green)",
    "sku": "76045-gn",
    "category": "Robot Parts",
    "description": "192mm Flat Beam (Green) · $3.29 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/192mm-flat-beam-green",
    "imageUrl": "https://www.studica.com/images/thumbs/0016876_192mm-flat-beam-green_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76045-rd",
    "name": "192mm Flat Beam (Red)",
    "sku": "76045-rd",
    "category": "Robot Parts",
    "description": "192mm Flat Beam (Red) · $3.29 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/192mm-flat-beam-red",
    "imageUrl": "https://www.studica.com/images/thumbs/0016877_192mm-flat-beam-red_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76045gp",
    "name": "192mm Flat Beam",
    "sku": "76045GP",
    "category": "Robot Parts",
    "description": "192mm Flat Beam · price not listed · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 192mm Flat Beam is a 3mm thick and 8mm wide structural support beam, now available in six different colors. As with the other Studica Robotics building components, it has the common patented hole pattern which makes it easy to connect to other structures with very little or no additional machining required. These anodized, deburred and polished pieces are strong and safe to work with. Note: Our new colors are now in stock !",
    "productUrl": "https://www.studica.com/192mm-flat-beam-3",
    "imageUrl": "https://www.studica.com/images/thumbs/0018074_192mm-flat-beam_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76046",
    "name": "144mm Flat Beam (Blue)",
    "sku": "76046",
    "category": "Robot Parts",
    "description": "144mm Flat Beam (Blue) · $2.59 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/144mm-flat-beam-blue",
    "imageUrl": "https://www.studica.com/images/thumbs/0016861_144mm-flat-beam-blue_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76046-bk",
    "name": "144mm Flat Beam (Black)",
    "sku": "76046-bk",
    "category": "Robot Parts",
    "description": "144mm Flat Beam (Black) · $2.59 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/144mm-flat-beam-black",
    "imageUrl": "https://www.studica.com/images/thumbs/0016866_144mm-flat-beam-black_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76046-cl",
    "name": "144mm Flat Beam (Silver)",
    "sku": "76046-cl",
    "category": "Robot Parts",
    "description": "144mm Flat Beam (Silver) · $2.19 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/144mm-flat-beam-clear",
    "imageUrl": "https://www.studica.com/images/thumbs/0016862_144mm-flat-beam-silver_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76046-gd",
    "name": "144mm Flat Beam (Gold)",
    "sku": "76046-gd",
    "category": "Robot Parts",
    "description": "144mm Flat Beam (Gold) · $2.59 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/144mm-flat-beam-gold",
    "imageUrl": "https://www.studica.com/images/thumbs/0016863_144mm-flat-beam-gold_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76046-gn",
    "name": "144mm Flat Beam (Green)",
    "sku": "76046-gn",
    "category": "Robot Parts",
    "description": "144mm Flat Beam (Green) · $2.59 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/144mm-flat-beam-green",
    "imageUrl": "https://www.studica.com/images/thumbs/0016864_144mm-flat-beam-green_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76046-rd",
    "name": "144mm Flat Beam (Red)",
    "sku": "76046-rd",
    "category": "Robot Parts",
    "description": "144mm Flat Beam (Red) · $2.19 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/144mm-flat-beam-red",
    "imageUrl": "https://www.studica.com/images/thumbs/0016865_144mm-flat-beam-red_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76046gp",
    "name": "144mm Flat Beam",
    "sku": "76046GP",
    "category": "Robot Parts",
    "description": "144mm Flat Beam · price not listed · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 144m Flat Beam is 3mm thick and 8mm wide, now available in six different colors. As with the other Studica Robotics building components, it has the common hole pattern which makes it easy to connect to other structure with very little or no additional machining required. You can easily connect to other channel, extrusions, bushings, bearing, mounting brackets and more so you can quickly assemble and disassemble robots and automated systems. Ideal for rapid prototyping. These",
    "productUrl": "https://www.studica.com/144mm-flat-beam-3",
    "imageUrl": "https://www.studica.com/images/thumbs/0018075_144mm-flat-beam_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76047",
    "name": "96mm Flat Beam (Blue)",
    "sku": "76047",
    "category": "Robot Parts",
    "description": "96mm Flat Beam (Blue) · $1.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/96mm-flat-beam-blue-2",
    "imageUrl": "https://www.studica.com/images/thumbs/0017769_96mm-flat-beam-blue_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76047-bk",
    "name": "96mm Flat Beam (Black)",
    "sku": "76047-bk",
    "category": "Robot Parts",
    "description": "96mm Flat Beam (Black) · $1.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/96mm-flat-beam-black",
    "imageUrl": "https://www.studica.com/images/thumbs/0016854_96mm-flat-beam-black_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76047-cl",
    "name": "96mm Flat Beam (Silver)",
    "sku": "76047-cl",
    "category": "Robot Parts",
    "description": "96mm Flat Beam (Silver) · $1.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/96mm-flat-beam-clear",
    "imageUrl": "https://www.studica.com/images/thumbs/0016850_96mm-flat-beam-silver_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76047-gd",
    "name": "96mm Flat Beam (Gold)",
    "sku": "76047-gd",
    "category": "Robot Parts",
    "description": "96mm Flat Beam (Gold) · $1.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/96mm-flat-beam-gold",
    "imageUrl": "https://www.studica.com/images/thumbs/0016851_96mm-flat-beam-gold_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76047-gn",
    "name": "96mm Flat Beam (Green)",
    "sku": "76047-gn",
    "category": "Robot Parts",
    "description": "96mm Flat Beam (Green) · $1.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/96mm-flat-beam-green",
    "imageUrl": "https://www.studica.com/images/thumbs/0016852_96mm-flat-beam-green_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76047-rd",
    "name": "96mm Flat Beam (Red)",
    "sku": "76047-rd",
    "category": "Robot Parts",
    "description": "96mm Flat Beam (Red) · $1.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/96mm-flat-beam-red",
    "imageUrl": "https://www.studica.com/images/thumbs/0016853_96mm-flat-beam-red_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76047gp",
    "name": "96mm Flat Beam",
    "sku": "76047GP",
    "category": "Robot Parts",
    "description": "96mm Flat Beam · price not listed · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 96mm Flat Beam is 3mm thick and 8mm wide, now available in six different colors. As with the other Studica Robotics building components, it has a common hole pattern which makes it easy to connect to other structure with very little or no additional machining required. These anodized, deburred and polished pieces are strong and safe to work with. Note: Our new colors are now in stock !",
    "productUrl": "https://www.studica.com/96mm-flat-beam-2-pack-2",
    "imageUrl": "https://www.studica.com/images/thumbs/0018076_96mm-flat-beam_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76048",
    "name": "48mm Flat Beam (Blue)",
    "sku": "76048",
    "category": "Robot Parts",
    "description": "48mm Flat Beam (Blue) · $1.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/48mm-flat-beam-blue",
    "imageUrl": "https://www.studica.com/images/thumbs/0016837_48mm-flat-beam-blue_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76048-bk",
    "name": "48mm Flat Beam (Black)",
    "sku": "76048-bk",
    "category": "Robot Parts",
    "description": "48mm Flat Beam (Black) · $1.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/48mm-flat-beam-black",
    "imageUrl": "https://www.studica.com/images/thumbs/0016842_48mm-flat-beam-black_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76048-cl",
    "name": "48mm Flat Beam (Silver)",
    "sku": "76048-cl",
    "category": "Robot Parts",
    "description": "48mm Flat Beam (Silver) · $1.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/48mm-flat-beam-clear",
    "imageUrl": "https://www.studica.com/images/thumbs/0016838_48mm-flat-beam-silver_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76048-gd",
    "name": "48mm Flat Beam (Gold)",
    "sku": "76048-gd",
    "category": "Robot Parts",
    "description": "48mm Flat Beam (Gold) · $1.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/48mm-flat-beam-gold",
    "imageUrl": "https://www.studica.com/images/thumbs/0016839_48mm-flat-beam-gold_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76048-gn",
    "name": "48mm Flat Beam (Green)",
    "sku": "76048-gn",
    "category": "Robot Parts",
    "description": "48mm Flat Beam (Green) · $1.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/48mm-flat-beam-green",
    "imageUrl": "https://www.studica.com/images/thumbs/0016840_48mm-flat-beam-green_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76048-rd",
    "name": "48mm Flat Beam (Red)",
    "sku": "76048-rd",
    "category": "Robot Parts",
    "description": "48mm Flat Beam (Red) · $1.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/48mm-flat-beam-red",
    "imageUrl": "https://www.studica.com/images/thumbs/0016841_48mm-flat-beam-red_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76048gp",
    "name": "48mm Flat Beam",
    "sku": "76048GP",
    "category": "Robot Parts",
    "description": "48mm Flat Beam · price not listed · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 48mm Flat Beam is 3mm thick and 8mm wide, now available in six different colors. As with the other Studica Robotics building components, it has the common hole pattern which makes it easy to connect to other structure with very little or no additional machining required. These anodized, deburred and polished pieces are strong and safe to work with. Note: Our new colors are now in stock !",
    "productUrl": "https://www.studica.com/48mm-flat-beam-3",
    "imageUrl": "https://www.studica.com/images/thumbs/0018084_48mm-flat-beam_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76058",
    "name": "432mm x 48mm Flat Bracket (Blue)",
    "sku": "76058",
    "category": "Robot Parts",
    "description": "432mm x 48mm Flat Bracket (Blue) · $13.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/432mm-x-40mm-flat-bracket-blue",
    "imageUrl": "https://www.studica.com/images/thumbs/0017494_432mm-x-48mm-flat-bracket-blue_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76058-bk",
    "name": "432mm x 48mm Flat Bracket (Black)",
    "sku": "76058-bk",
    "category": "Robot Parts",
    "description": "432mm x 48mm Flat Bracket (Black) · $13.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/432mm-x-40mm-flat-bracket-black",
    "imageUrl": "https://www.studica.com/images/thumbs/0017499_432mm-x-48mm-flat-bracket-black_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76058-cl",
    "name": "432mm x 48mm Flat Bracket (Silver)",
    "sku": "76058-cl",
    "category": "Robot Parts",
    "description": "432mm x 48mm Flat Bracket (Silver) · $11.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/432mm-x-40mm-flat-bracket-clear",
    "imageUrl": "https://www.studica.com/images/thumbs/0017495_432mm-x-48mm-flat-bracket-silver_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76058-gd",
    "name": "432mm x 48mm Flat Bracket (Gold)",
    "sku": "76058-gd",
    "category": "Robot Parts",
    "description": "432mm x 48mm Flat Bracket (Gold) · $13.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/432mm-x-40mm-flat-bracket-gold",
    "imageUrl": "https://www.studica.com/images/thumbs/0017496_432mm-x-48mm-flat-bracket-gold_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76058-gn",
    "name": "432mm x 48mm Flat Bracket (Green)",
    "sku": "76058-gn",
    "category": "Robot Parts",
    "description": "432mm x 48mm Flat Bracket (Green) · $13.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/432mm-x-40mm-flat-bracket-green",
    "imageUrl": "https://www.studica.com/images/thumbs/0017497_432mm-x-48mm-flat-bracket-green_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76058-rd",
    "name": "432mm x 48mm Flat Bracket (Red)",
    "sku": "76058-rd",
    "category": "Robot Parts",
    "description": "432mm x 48mm Flat Bracket (Red) · $13.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/432mm-x-40mm-flat-bracket-red",
    "imageUrl": "https://www.studica.com/images/thumbs/0017498_432mm-x-48mm-flat-bracket-red_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76058gp",
    "name": "432mm x 48mm Flat Bracket",
    "sku": "76058GP",
    "category": "Robot Parts",
    "description": "432mm x 48mm Flat Bracket · price not listed · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 432mm flat bracket, available in six different colors, has a height of 14mm and a width of 48mm. As with the other Studica Robotics building components, it has the common hole pattern which makes it easy to connect to other structure with very little or no additional machining required. These anodized, deburred and polished pieces are strong and safe to work with. Note: Our new colors are now in stock !",
    "productUrl": "https://www.studica.com/432mm-x-40mm-flat-bracket",
    "imageUrl": "https://www.studica.com/images/thumbs/0018097_432mm-x-48mm-flat-bracket_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76059",
    "name": "384mm x 40mm Flat Bracket (Blue)",
    "sku": "76059",
    "category": "Robot Parts",
    "description": "384mm x 40mm Flat Bracket (Blue) · $12.59 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/384mm-x-40m-flat-bracket-blue",
    "imageUrl": "https://www.studica.com/images/thumbs/0017482_384mm-x-40mm-flat-bracket-blue_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76059-bk",
    "name": "384mm x 40mm Flat Bracket (Black)",
    "sku": "76059-bk",
    "category": "Robot Parts",
    "description": "384mm x 40mm Flat Bracket (Black) · $12.59 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/384mm-x-40m-flat-bracket-black",
    "imageUrl": "https://www.studica.com/images/thumbs/0017487_384mm-x-40mm-flat-bracket-black_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76059-cl",
    "name": "384mm x 40mm Flat Bracket (Silver)",
    "sku": "76059-cl",
    "category": "Robot Parts",
    "description": "384mm x 40mm Flat Bracket (Silver) · $10.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/384mm-x-40m-flat-bracket-clear",
    "imageUrl": "https://www.studica.com/images/thumbs/0017483_384mm-x-40mm-flat-bracket-silver_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76059-gd",
    "name": "384mm x 40mm Flat Bracket (Gold)",
    "sku": "76059-gd",
    "category": "Robot Parts",
    "description": "384mm x 40mm Flat Bracket (Gold) · $12.59 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/384mm-x-40m-flat-bracket-gold",
    "imageUrl": "https://www.studica.com/images/thumbs/0017484_384mm-x-40mm-flat-bracket-gold_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76059-gn",
    "name": "384mm x 40mm Flat Bracket (Green)",
    "sku": "76059-gn",
    "category": "Robot Parts",
    "description": "384mm x 40mm Flat Bracket (Green) · $12.59 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/384mm-x-40m-flat-bracket-green",
    "imageUrl": "https://www.studica.com/images/thumbs/0017485_384mm-x-40mm-flat-bracket-green_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76059-rd",
    "name": "384mm x 40mm Flat Bracket (Red)",
    "sku": "76059-rd",
    "category": "Robot Parts",
    "description": "384mm x 40mm Flat Bracket (Red) · $12.59 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/384mm-x-40m-flat-bracket-red",
    "imageUrl": "https://www.studica.com/images/thumbs/0017486_384mm-x-40mm-flat-bracket-red_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76059gp",
    "name": "384mm x 40mm Flat Bracket",
    "sku": "76059GP",
    "category": "Robot Parts",
    "description": "384mm x 40mm Flat Bracket · price not listed · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 384mm Flat Bracket, available in six different colors, has dimensions of 3mm thickness x 40mm width. As with the other Studica Robotics building components, it has the common hole pattern which makes it easy to connect to other structure with very little or no additional machining required. These anodized, deburred and polished pieces are strong and safe to work with. Note: Our new colors are now in stock !",
    "productUrl": "https://www.studica.com/384mm-x-40m-flat-bracket",
    "imageUrl": "https://www.studica.com/images/thumbs/0018095_384mm-x-40mm-flat-bracket_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76060",
    "name": "336mm x 40mm Flat Bracket (Blue)",
    "sku": "76060",
    "category": "Robot Parts",
    "description": "336mm x 40mm Flat Bracket (Blue) · $11.39 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/336mm-x-40mm-flat-bracket-blue",
    "imageUrl": "https://www.studica.com/images/thumbs/0017470_336mm-x-40mm-flat-bracket-blue_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76060-bk",
    "name": "336mm x 40mm Flat Bracket (Black)",
    "sku": "76060-bk",
    "category": "Robot Parts",
    "description": "336mm x 40mm Flat Bracket (Black) · $11.39 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/336mm-x-40mm-flat-bracket-black",
    "imageUrl": "https://www.studica.com/images/thumbs/0017475_336mm-x-40mm-flat-bracket-black_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76060-cl",
    "name": "336mm x 40mm Flat Bracket (Silver)",
    "sku": "76060-cl",
    "category": "Robot Parts",
    "description": "336mm x 40mm Flat Bracket (Silver) · $9.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/336mm-x-40mm-flat-bracket-clear",
    "imageUrl": "https://www.studica.com/images/thumbs/0017471_336mm-x-40mm-flat-bracket-silver_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76060-gd",
    "name": "336mm x 40mm Flat Bracket (Gold)",
    "sku": "76060-gd",
    "category": "Robot Parts",
    "description": "336mm x 40mm Flat Bracket (Gold) · $11.39 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/336mm-x-40mm-flat-bracket-gold",
    "imageUrl": "https://www.studica.com/images/thumbs/0017472_336mm-x-40mm-flat-bracket-gold_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76060-gn",
    "name": "336mm x 40mm Flat Bracket (Green)",
    "sku": "76060-gn",
    "category": "Robot Parts",
    "description": "336mm x 40mm Flat Bracket (Green) · $11.39 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/336mm-x-40mm-flat-bracket-green",
    "imageUrl": "https://www.studica.com/images/thumbs/0017473_336mm-x-40mm-flat-bracket-green_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76060-rd",
    "name": "336mm x 40mm Flat Bracket (Red)",
    "sku": "76060-rd",
    "category": "Robot Parts",
    "description": "336mm x 40mm Flat Bracket (Red) · $11.39 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/336mm-x-40mm-flat-bracket-red",
    "imageUrl": "https://www.studica.com/images/thumbs/0017474_336mm-x-40mm-flat-bracket-red_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76060gp",
    "name": "336mm x 40mm Flat Bracket",
    "sku": "76060GP",
    "category": "Robot Parts",
    "description": "336mm x 40mm Flat Bracket · price not listed · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 336mm Flat Bracket, available in six different colors, has a dimension of 3mm thickness x 40mm wide. As with the other Studica Robotics building components, it has the common hole pattern which makes it easy to connect to other structure with very little or no additional machining required. These anodized, deburred and polished pieces are strong and safe to work with. Note: Our new colors are now in stock !",
    "productUrl": "https://www.studica.com/336mm-x-40m-flat-bracket",
    "imageUrl": "https://www.studica.com/images/thumbs/0018094_336mm-x-40mm-flat-bracket_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76061",
    "name": "288mm x 40mm Flat Bracket (Blue)",
    "sku": "76061",
    "category": "Robot Parts",
    "description": "288mm x 40mm Flat Bracket (Blue) · $9.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/288mm-x-40mm-flat-bracket-blue-2",
    "imageUrl": "https://www.studica.com/images/thumbs/0017765_288mm-x-40mm-flat-bracket-blue_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76061-bk",
    "name": "288mm x 40mm Flat Bracket (Black)",
    "sku": "76061-bk",
    "category": "Robot Parts",
    "description": "288mm x 40mm Flat Bracket (Black) · $9.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/288mm-x-40mm-flat-bracket-black",
    "imageUrl": "https://www.studica.com/images/thumbs/0017463_288mm-x-40mm-flat-bracket-black_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76061-cl",
    "name": "288mm x 40mm Flat Bracket (Silver)",
    "sku": "76061-cl",
    "category": "Robot Parts",
    "description": "288mm x 40mm Flat Bracket (Silver) · $6.79 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/288mm-x-40mm-flat-bracket-silver",
    "imageUrl": "https://www.studica.com/images/thumbs/0017459_288mm-x-40mm-flat-bracket-silver_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76061-gd",
    "name": "288mm x 40mm Flat Bracket (Gold)",
    "sku": "76061-gd",
    "category": "Robot Parts",
    "description": "288mm x 40mm Flat Bracket (Gold) · $9.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/288mm-x-40mm-flat-bracket-gold",
    "imageUrl": "https://www.studica.com/images/thumbs/0017460_288mm-x-40mm-flat-bracket-gold_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76061-gn",
    "name": "288mm x 40mm Flat Bracket (Green)",
    "sku": "76061-gn",
    "category": "Robot Parts",
    "description": "288mm x 40mm Flat Bracket (Green) · $9.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/288mm-x-40mm-flat-bracket-green",
    "imageUrl": "https://www.studica.com/images/thumbs/0017461_288mm-x-40mm-flat-bracket-green_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76061-rd",
    "name": "288mm x 40mm Flat Bracket (Red)",
    "sku": "76061-rd",
    "category": "Robot Parts",
    "description": "288mm x 40mm Flat Bracket (Red) · $9.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/288mm-x-40mm-flat-bracket-red",
    "imageUrl": "https://www.studica.com/images/thumbs/0017462_288mm-x-40mm-flat-bracket-red_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76061gp",
    "name": "288mm x 40mm Flat Bracket",
    "sku": "76061GP",
    "category": "Robot Parts",
    "description": "288mm x 40mm Flat Bracket · price not listed · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 288mm Flat Bracket, available in six different colors, blue, silver, gold, green, red and black. They have a thickness of 3mm and a width of 40mm. As with the other Studica Robotics building components, it has the common patented hole pattern which makes it easy to connect to other structure with very little or no additional machining required. You can easily connect to other channel, extrusions, bushings, bearing, mounting brackets and more so you can quickly assemble and d",
    "productUrl": "https://www.studica.com/288mm-x-40mm-flat-bracket",
    "imageUrl": "https://www.studica.com/images/thumbs/0018093_288mm-x-40mm-flat-bracket_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76062",
    "name": "240mm x 40mm Flat Bracket (Blue)",
    "sku": "76062",
    "category": "Robot Parts",
    "description": "240mm x 40mm Flat Bracket (Blue) · $8.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/240mm-x-40mm-flat-bracket-blue",
    "imageUrl": "https://www.studica.com/images/thumbs/0017446_240mm-x-40mm-flat-bracket-blue_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76062-bk",
    "name": "240mm x 40mm Flat Bracket (Black)",
    "sku": "76062-bk",
    "category": "Robot Parts",
    "description": "240mm x 40mm Flat Bracket (Black) · $8.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/240mm-x-40mm-flat-bracket-black",
    "imageUrl": "https://www.studica.com/images/thumbs/0017451_240mm-x-40mm-flat-bracket-black_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76062-cl",
    "name": "240mm x 40mm Flat Bracket (Silver)",
    "sku": "76062-cl",
    "category": "Robot Parts",
    "description": "240mm x 40mm Flat Bracket (Silver) · $6.29 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/240mm-x-40mm-flat-bracket-clear",
    "imageUrl": "https://www.studica.com/images/thumbs/0017447_240mm-x-40mm-flat-bracket-silver_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76062-gd",
    "name": "240mm x 40mm Flat Bracket (Gold)",
    "sku": "76062-gd",
    "category": "Robot Parts",
    "description": "240mm x 40mm Flat Bracket (Gold) · $8.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/240mm-x-40mm-flat-bracket-gold",
    "imageUrl": "https://www.studica.com/images/thumbs/0017448_240mm-x-40mm-flat-bracket-gold_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76062-gn",
    "name": "240mm x 40mm Flat Bracket (Green)",
    "sku": "76062-gn",
    "category": "Robot Parts",
    "description": "240mm x 40mm Flat Bracket (Green) · $8.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/240mm-x-40mm-flat-bracket-green",
    "imageUrl": "https://www.studica.com/images/thumbs/0017449_240mm-x-40mm-flat-bracket-green_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76062-rd",
    "name": "240mm x 40mm Flat Bracket (Red)",
    "sku": "76062-rd",
    "category": "Robot Parts",
    "description": "240mm x 40mm Flat Bracket (Red) · $8.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/240mm-x-40mm-flat-bracket-red",
    "imageUrl": "https://www.studica.com/images/thumbs/0017450_240mm-x-40mm-flat-bracket-red_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76062gp",
    "name": "240mm x 40mm Flat Bracket",
    "sku": "76062GP",
    "category": "Robot Parts",
    "description": "240mm x 40mm Flat Bracket · price not listed · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 240mm Flat Bracket, available in six different colors, is 3mm x 40mm wide, and very strong. As with the other Studica Robotics building components, it has the common hole pattern which makes it easy to connect to other structure with very little or no additional machining required. These anodized, deburred and polished pieces are strong and safe to work with. Note: Our new colors are now in stock !",
    "productUrl": "https://www.studica.com/240mm-x-40mm-flat-bracket",
    "imageUrl": "https://www.studica.com/images/thumbs/0018090_240mm-x-40mm-flat-bracket_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76063",
    "name": "192mm x 40mm Flat Bracket (Blue)",
    "sku": "76063",
    "category": "Robot Parts",
    "description": "192mm x 40mm Flat Bracket (Blue) · $6.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/192mm-x-40mm-flat-bracket-blue-2",
    "imageUrl": "https://www.studica.com/images/thumbs/0017760_192mm-x-40mm-flat-bracket-blue_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76063-bk",
    "name": "192mm x 40mm Flat Bracket (Black)",
    "sku": "76063-bk",
    "category": "Robot Parts",
    "description": "192mm x 40mm Flat Bracket (Black) · $6.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/192mm-x-40mm-flat-bracket-black",
    "imageUrl": "https://www.studica.com/images/thumbs/0017427_192mm-x-40mm-flat-bracket-black_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76063-cl",
    "name": "192mm x 40mm Flat Bracket (Silver)",
    "sku": "76063-cl",
    "category": "Robot Parts",
    "description": "192mm x 40mm Flat Bracket (Silver) · $5.29 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/192mm-x-40mm-flat-bracket-clear",
    "imageUrl": "https://www.studica.com/images/thumbs/0017423_192mm-x-40mm-flat-bracket-silver_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76063-gd",
    "name": "192mm x 40mm Flat Bracket (Gold)",
    "sku": "76063-gd",
    "category": "Robot Parts",
    "description": "192mm x 40mm Flat Bracket (Gold) · $6.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/192mm-x-40mm-flat-bracket-gold",
    "imageUrl": "https://www.studica.com/images/thumbs/0017424_192mm-x-40mm-flat-bracket-gold_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76063-gn",
    "name": "192mm x 40mm Flat Bracket (Green)",
    "sku": "76063-gn",
    "category": "Robot Parts",
    "description": "192mm x 40mm Flat Bracket (Green) · $6.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/192mm-x-40mm-flat-bracket-green",
    "imageUrl": "https://www.studica.com/images/thumbs/0017425_192mm-x-40mm-flat-bracket-green_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76063-rd",
    "name": "192mm x 40mm Flat Bracket (Red)",
    "sku": "76063-rd",
    "category": "Robot Parts",
    "description": "192mm x 40mm Flat Bracket (Red) · $6.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/192mm-x-40mm-flat-bracket-red",
    "imageUrl": "https://www.studica.com/images/thumbs/0017426_192mm-x-40mm-flat-bracket-red_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76063gp",
    "name": "192mm x 40mm Flat Bracket",
    "sku": "76063GP",
    "category": "Robot Parts",
    "description": "192mm x 40mm Flat Bracket · price not listed · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 192mm Flat Bracket has dimensions of 3mm thickness x 40mm width and part of our colored structure collection . As with the other Studica Robotics building components, it has the common hole pattern which makes it easy to connect to other structure with very little or no additional machining required. You can easily connect to other channel, extrusions, bushings, bearing, mounting brackets and more so you can quickly assemble and disassemble robots and automated systems. Thes",
    "productUrl": "https://www.studica.com/192mm-x-40mm-flat-bracket-2-pack",
    "imageUrl": "https://www.studica.com/images/thumbs/0018089_192mm-x-40mm-flat-bracket_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76064",
    "name": "144mm x 40mm Flat Bracket (Blue)",
    "sku": "76064",
    "category": "Robot Parts",
    "description": "144mm x 40mm Flat Bracket (Blue) · $5.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/144mm-x-40mm-flat-bracket-blue-2",
    "imageUrl": "https://www.studica.com/images/thumbs/0017759_144mm-x-40mm-flat-bracket-blue_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76064-bk",
    "name": "144mm x 40mm Flat Bracket (Black)",
    "sku": "76064-bk",
    "category": "Robot Parts",
    "description": "144mm x 40mm Flat Bracket (Black) · $5.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/144mm-x-40mm-flat-bracket-black",
    "imageUrl": "https://www.studica.com/images/thumbs/0017415_144mm-x-40mm-flat-bracket-black_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76064-cl",
    "name": "144mm x 40mm Flat Bracket (Silver)",
    "sku": "76064-cl",
    "category": "Robot Parts",
    "description": "144mm x 40mm Flat Bracket (Silver) · $4.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/144mm-x-40mm-flat-bracket-clear",
    "imageUrl": "https://www.studica.com/images/thumbs/0017411_144mm-x-40mm-flat-bracket-silver_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76064-gd",
    "name": "144mm x 40mm Flat Bracket (Gold)",
    "sku": "76064-gd",
    "category": "Robot Parts",
    "description": "144mm x 40mm Flat Bracket (Gold) · $5.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/144mm-x-40mm-flat-bracket-gold",
    "imageUrl": "https://www.studica.com/images/thumbs/0017412_144mm-x-40mm-flat-bracket-gold_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76064-gn",
    "name": "144mm x 40mm Flat Bracket (Green)",
    "sku": "76064-gn",
    "category": "Robot Parts",
    "description": "144mm x 40mm Flat Bracket (Green) · $5.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/144mm-x-40mm-flat-bracket-green",
    "imageUrl": "https://www.studica.com/images/thumbs/0017413_144mm-x-40mm-flat-bracket-green_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76064-rd",
    "name": "144mm x 40mm Flat Bracket (Red)",
    "sku": "76064-rd",
    "category": "Robot Parts",
    "description": "144mm x 40mm Flat Bracket (Red) · $5.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/144mm-x-40mm-flat-bracket-red",
    "imageUrl": "https://www.studica.com/images/thumbs/0017414_144mm-x-40mm-flat-bracket-red_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76064gp",
    "name": "144mm x 40mm Flat Bracket",
    "sku": "76064GP",
    "category": "Robot Parts",
    "description": "144mm x 40mm Flat Bracket · price not listed · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 144mm Flat Bracket, available in six different colors, has dimensions of 3mm thickness x 40mm width. As with the other Studica Robotics building components, it has the common hole pattern which makes it easy to connect to other structure with very little or no additional machining required. You can easily connect to other channel, extrusions, bushings, bearing, mounting brackets and more so you can quickly assemble and disassemble robots and automated systems. These anodized",
    "productUrl": "https://www.studica.com/144mm-x-40mm-flat-bracket-2-pack",
    "imageUrl": "https://www.studica.com/images/thumbs/0018088_144mm-x-40mm-flat-bracket_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76065",
    "name": "96mm x 40mm Flat Bracket (Blue)",
    "sku": "76065",
    "category": "Robot Parts",
    "description": "96mm x 40mm Flat Bracket (Blue) · $3.89 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/96mm-x-40mm-flat-bracket-blue-2",
    "imageUrl": "https://www.studica.com/images/thumbs/0017771_96mm-x-40mm-flat-bracket-blue_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76065-bk",
    "name": "96mm x 40mm Flat Bracket (Black)",
    "sku": "76065-bk",
    "category": "Robot Parts",
    "description": "96mm x 40mm Flat Bracket (Black) · $3.89 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/96mm-x-40mm-flat-bracket-black",
    "imageUrl": "https://www.studica.com/images/thumbs/0017306_96mm-x-40mm-flat-bracket-black_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76065-cl",
    "name": "96mm x 40mm Flat Bracket (Silver)",
    "sku": "76065-cl",
    "category": "Robot Parts",
    "description": "96mm x 40mm Flat Bracket (Silver) · $3.29 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/96mm-x-40mm-flat-bracket-clear",
    "imageUrl": "https://www.studica.com/images/thumbs/0017302_96mm-x-40mm-flat-bracket-silver_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76065-gd",
    "name": "96mm x 40mm Flat Bracket (Gold)",
    "sku": "76065-gd",
    "category": "Robot Parts",
    "description": "96mm x 40mm Flat Bracket (Gold) · $3.89 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/96mm-x-40mm-flat-bracket-gold",
    "imageUrl": "https://www.studica.com/images/thumbs/0017303_96mm-x-40mm-flat-bracket-gold_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76065-gn",
    "name": "96mm x 40mm Flat Bracket (Green)",
    "sku": "76065-gn",
    "category": "Robot Parts",
    "description": "96mm x 40mm Flat Bracket (Green) · $3.89 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/96mm-x-40mm-flat-bracket-green",
    "imageUrl": "https://www.studica.com/images/thumbs/0017304_96mm-x-40mm-flat-bracket-green_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76065-rd",
    "name": "96mm x 40mm Flat Bracket (Red)",
    "sku": "76065-rd",
    "category": "Robot Parts",
    "description": "96mm x 40mm Flat Bracket (Red) · $3.89 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/96mm-x-40mm-flat-bracket-red",
    "imageUrl": "https://www.studica.com/images/thumbs/0017305_96mm-x-40mm-flat-bracket-red_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76065gp",
    "name": "96mm x 40mm Flat Bracket",
    "sku": "76065GP",
    "category": "Robot Parts",
    "description": "96mm x 40mm Flat Bracket · price not listed · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 96mm Flat Bracket, available in six different colors, has dimensions of 3mm thickness x 40mm width. As with the other Studica Robotics building components, it has the common hole pattern which makes it easy to connect to other structure with very little or no additional machining required. You can easily connect to other channel, extrusions, bushings, bearing, mounting brackets and more so you can quickly assemble and disassemble robots and automated systems. These anodized,",
    "productUrl": "https://www.studica.com/96mm-x-40mm-flat-bracket",
    "imageUrl": "https://www.studica.com/images/thumbs/0018087_96mm-x-40mm-flat-bracket_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76066",
    "name": "192mm x 96mm Flat Bracket (Blue)",
    "sku": "76066",
    "category": "Robot Parts",
    "description": "192mm x 96mm Flat Bracket (Blue) · $10.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/192mm-x-96mm-flat-bracket-blue-2",
    "imageUrl": "https://www.studica.com/images/thumbs/0017761_192mm-x-96mm-flat-bracket-blue_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76066-bk",
    "name": "192mm x 96mm Flat Bracket (Black)",
    "sku": "76066-bk",
    "category": "Robot Parts",
    "description": "192mm x 96mm Flat Bracket (Black) · $10.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/192mm-x-96mm-flat-bracket-black",
    "imageUrl": "https://www.studica.com/images/thumbs/0017439_192mm-x-96mm-flat-bracket-black_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76066-cl",
    "name": "192mm x 96mm Flat Bracket (Silver)",
    "sku": "76066-cl",
    "category": "Robot Parts",
    "description": "192mm x 96mm Flat Bracket (Silver) · $7.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/192mm-x-96mm-flat-bracket-clear",
    "imageUrl": "https://www.studica.com/images/thumbs/0017435_192mm-x-96mm-flat-bracket-silver_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76066-gd",
    "name": "192mm x 96mm Flat Bracket (Gold)",
    "sku": "76066-gd",
    "category": "Robot Parts",
    "description": "192mm x 96mm Flat Bracket (Gold) · $10.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/192mm-x-96mm-flat-bracket-gold",
    "imageUrl": "https://www.studica.com/images/thumbs/0017436_192mm-x-96mm-flat-bracket-gold_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76066-gn",
    "name": "192mm x 96mm Flat Bracket (Green)",
    "sku": "76066-gn",
    "category": "Robot Parts",
    "description": "192mm x 96mm Flat Bracket (Green) · $10.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/192mm-x-96mm-flat-bracket-green",
    "imageUrl": "https://www.studica.com/images/thumbs/0017437_192mm-x-96mm-flat-bracket-green_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76066-rd",
    "name": "192mm x 96mm Flat Bracket (Red)",
    "sku": "76066-rd",
    "category": "Robot Parts",
    "description": "192mm x 96mm Flat Bracket (Red) · $10.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/192mm-x-96mm-flat-bracket-red",
    "imageUrl": "https://www.studica.com/images/thumbs/0017438_192mm-x-96mm-flat-bracket-red_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76066gp",
    "name": "192mm x 96mm Flat Bracket",
    "sku": "76066GP",
    "category": "Robot Parts",
    "description": "192mm x 96mm Flat Bracket · price not listed · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 192mm x 96mm Flat Bracket, available in six different colors, is very strong, with a thickness of 3mm. As with the other Studica Robotics building components, it has the common hole pattern which makes it easy to connect to other structure with very little or no additional machining required. These anodized, deburred and polished pieces are strong and safe to work with. Note: Our new colors are now in stock !",
    "productUrl": "https://www.studica.com/192mm-x-96mm-flat-bracket",
    "imageUrl": "https://www.studica.com/images/thumbs/0018092_192mm-x-96mm-flat-bracket_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76080",
    "name": "120 Degree Bracket (Blue)",
    "sku": "76080",
    "category": "Robot Parts",
    "description": "120 Degree Bracket (Blue) · $6.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/120-degree-bracket-blue-2",
    "imageUrl": "https://www.studica.com/images/thumbs/0017756_120-degree-bracket-blue_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76080-bk",
    "name": "120 Degree Bracket (Black)",
    "sku": "76080-bk",
    "category": "Robot Parts",
    "description": "120 Degree Bracket (Black) · $6.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/120-degree-bracket-black",
    "imageUrl": "https://www.studica.com/images/thumbs/0016817_120-degree-bracket-black_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76080-cl",
    "name": "120 Degree Bracket (Silver)",
    "sku": "76080-cl",
    "category": "Robot Parts",
    "description": "120 Degree Bracket (Silver) · $6.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/120-degree-bracket-clear",
    "imageUrl": "https://www.studica.com/images/thumbs/0016813_120-degree-bracket-silver_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76080-gd",
    "name": "120 Degree Bracket (Gold)",
    "sku": "76080-gd",
    "category": "Robot Parts",
    "description": "120 Degree Bracket (Gold) · $6.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/120-degree-bracket-gold",
    "imageUrl": "https://www.studica.com/images/thumbs/0016814_120-degree-bracket-gold_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76080-gn",
    "name": "120 Degree Bracket (Green)",
    "sku": "76080-gn",
    "category": "Robot Parts",
    "description": "120 Degree Bracket (Green) · $6.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/120-degree-bracket-green",
    "imageUrl": "https://www.studica.com/images/thumbs/0016815_120-degree-bracket-green_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76080-rd",
    "name": "120 Degree Bracket (Red)",
    "sku": "76080-rd",
    "category": "Robot Parts",
    "description": "120 Degree Bracket (Red) · $6.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/120-degree-bracket-red",
    "imageUrl": "https://www.studica.com/images/thumbs/0016816_120-degree-bracket-red_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76080gp",
    "name": "120 Degree Bracket",
    "sku": "76080GP",
    "category": "Robot Parts",
    "description": "120 Degree Bracket · price not listed · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 120 Degree Bracket, available in six different colors, is ideal for connecting two channel pieces at 120 degrees from each other. Each side is 48mm wide to fit perfectly on the channel. Use 3 brackets with 3 channel pieces to make 3 wheeled robots. These anodized, deburred and polished pieces are strong and safe to work with. Note: Our new colors are now in stock !",
    "productUrl": "https://www.studica.com/120-degree-bracket",
    "imageUrl": "https://www.studica.com/images/thumbs/0018046_120-degree-bracket_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76081",
    "name": "90 Degree Bracket (Blue)",
    "sku": "76081",
    "category": "Robot Parts",
    "description": "90 Degree Bracket (Blue) · $5.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/90-degree-bracket-blue-2",
    "imageUrl": "https://www.studica.com/images/thumbs/0017767_90-degree-bracket-blue_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76081-bk",
    "name": "90 Degree Bracket (Black)",
    "sku": "76081-bk",
    "category": "Robot Parts",
    "description": "90 Degree Bracket (Black) · $5.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/90-degree-bracket-black",
    "imageUrl": "https://www.studica.com/images/thumbs/0017282_90-degree-bracket-black_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76081-cl",
    "name": "90 Degree Bracket (Silver)",
    "sku": "76081-cl",
    "category": "Robot Parts",
    "description": "90 Degree Bracket (Silver) · $3.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/90-degree-bracket-clear",
    "imageUrl": "https://www.studica.com/images/thumbs/0017278_90-degree-bracket-silver_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76081-gd",
    "name": "90 Degree Bracket (Gold)",
    "sku": "76081-gd",
    "category": "Robot Parts",
    "description": "90 Degree Bracket (Gold) · $5.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/90-degree-bracket-gold",
    "imageUrl": "https://www.studica.com/images/thumbs/0017279_90-degree-bracket-gold_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76081-gn",
    "name": "90 Degree Bracket (Green)",
    "sku": "76081-gn",
    "category": "Robot Parts",
    "description": "90 Degree Bracket (Green) · $5.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/90-degree-bracket-green",
    "imageUrl": "https://www.studica.com/images/thumbs/0017280_90-degree-bracket-green_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76081-rd",
    "name": "90 Degree Bracket (Red)",
    "sku": "76081-rd",
    "category": "Robot Parts",
    "description": "90 Degree Bracket (Red) · $5.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/90-degree-bracket-red",
    "imageUrl": "https://www.studica.com/images/thumbs/0017281_90-degree-bracket-red_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76081gp",
    "name": "90 Degree Bracket",
    "sku": "76081GP",
    "category": "Robot Parts",
    "description": "90 Degree Bracket · price not listed · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 90 Degree Bracket is ideal for connecting two channel pieces at a 90-degree angle from each other and is part of our colored structure collection . Each side is 48mm wide to fit perfectly on the channel. As with the other Studica Robotics building components, it has the common hole pattern which makes it easy to connect to other structure with very little or no additional machining required. These anodized, deburred and polished pieces are strong and safe to work with. Note:",
    "productUrl": "https://www.studica.com/90-degree-bracket-2-pack-2",
    "imageUrl": "https://www.studica.com/images/thumbs/0017984_90-degree-bracket_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76082",
    "name": "135 Degree Bracket (Blue)",
    "sku": "76082",
    "category": "Robot Parts",
    "description": "135 Degree Bracket (Blue) · $5.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/135-degree-bracket-blue-2",
    "imageUrl": "https://www.studica.com/images/thumbs/0017757_135-degree-bracket-blue_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76082-bk",
    "name": "135 Degree Bracket (Black)",
    "sku": "76082-bk",
    "category": "Robot Parts",
    "description": "135 Degree Bracket (Black) · $5.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/135-degree-bracket-black",
    "imageUrl": "https://www.studica.com/images/thumbs/0016830_135-degree-bracket-black_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76082-cl",
    "name": "135 Degree Bracket (Silver)",
    "sku": "76082-cl",
    "category": "Robot Parts",
    "description": "135 Degree Bracket (Silver) · $3.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/135-degree-bracket-clear",
    "imageUrl": "https://www.studica.com/images/thumbs/0016826_135-degree-bracket-silver_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76082-gd",
    "name": "135 Degree Bracket (Gold)",
    "sku": "76082-gd",
    "category": "Robot Parts",
    "description": "135 Degree Bracket (Gold) · $5.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/135-degree-bracket-gold",
    "imageUrl": "https://www.studica.com/images/thumbs/0016827_135-degree-bracket-gold_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76082-gn",
    "name": "135 Degree Bracket (Green)",
    "sku": "76082-gn",
    "category": "Robot Parts",
    "description": "135 Degree Bracket (Green) · $5.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/135-degree-bracket-green",
    "imageUrl": "https://www.studica.com/images/thumbs/0016828_135-degree-bracket-green_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76082-rd",
    "name": "135 Degree Bracket (Red)",
    "sku": "76082-rd",
    "category": "Robot Parts",
    "description": "135 Degree Bracket (Red) · $5.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/135-degree-bracket-red",
    "imageUrl": "https://www.studica.com/images/thumbs/0016829_135-degree-bracket-red_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76082gp",
    "name": "135 Degree Bracket",
    "sku": "76082GP",
    "category": "Robot Parts",
    "description": "135 Degree Bracket · price not listed · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 135 Degree Bracket, available in six different colors, is ideal for connecting two channels pieces at 45 degrees from each other. Each side is 48mm wide to fit perfectly on the channel. These anodized, deburred and polished pieces are strong and safe to work with. Note: Our new colors are now in stock !",
    "productUrl": "https://www.studica.com/135-degree-bracket-2-pack-2",
    "imageUrl": "https://www.studica.com/images/thumbs/0018037_135-degree-bracket_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76083",
    "name": "96mm Adjustable Flat Bracket (Blue)",
    "sku": "76083",
    "category": "Robot Parts",
    "description": "96mm Adjustable Flat Bracket (Blue) · $3.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/96mm-adjustable-flat-bracket-blue-2",
    "imageUrl": "https://www.studica.com/images/thumbs/0017768_96mm-adjustable-flat-bracket-blue_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76083-bk",
    "name": "96mm Adjustable Flat Bracket (Black)",
    "sku": "76083-bk",
    "category": "Robot Parts",
    "description": "96mm Adjustable Flat Bracket (Black) · $3.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/96mm-adjustable-flat-bracket-black",
    "imageUrl": "https://www.studica.com/images/thumbs/0017294_96mm-adjustable-flat-bracket-black_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76083-cl",
    "name": "96mm Adjustable Flat Bracket (Silver)",
    "sku": "76083-cl",
    "category": "Robot Parts",
    "description": "96mm Adjustable Flat Bracket (Silver) · $2.79 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/96mm-adjustable-flat-bracket-clear",
    "imageUrl": "https://www.studica.com/images/thumbs/0017290_96mm-adjustable-flat-bracket-silver_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76083-gd",
    "name": "96mm Adjustable Flat Bracket (Gold)",
    "sku": "76083-gd",
    "category": "Robot Parts",
    "description": "96mm Adjustable Flat Bracket (Gold) · $3.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/96mm-adjustable-flat-bracket-gold",
    "imageUrl": "https://www.studica.com/images/thumbs/0017291_96mm-adjustable-flat-bracket-gold_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76083-gn",
    "name": "96mm Adjustable Flat Bracket (Green)",
    "sku": "76083-gn",
    "category": "Robot Parts",
    "description": "96mm Adjustable Flat Bracket (Green) · $3.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/96mm-adjustable-flat-bracket-green",
    "imageUrl": "https://www.studica.com/images/thumbs/0017292_96mm-adjustable-flat-bracket-green_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76083-rd",
    "name": "96mm Adjustable Flat Bracket (Red)",
    "sku": "76083-rd",
    "category": "Robot Parts",
    "description": "96mm Adjustable Flat Bracket (Red) · $3.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/96mm-adjustable-flat-bracket-red",
    "imageUrl": "https://www.studica.com/images/thumbs/0017293_96mm-adjustable-flat-bracket-red_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76083gp",
    "name": "96mm Adjustable Flat Bracket",
    "sku": "76083GP",
    "category": "Robot Parts",
    "description": "96mm Adjustable Flat Bracket · price not listed · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 96mm Adjustable Angle Flat Bracket, available in six different colors, is ideal for connecting two channels pieces together at various angles. It is 3mm thick and as with the other Studica Robotics building components, it has the common hole pattern which makes it easy to connect to other structure with very little or no additional machining required. These anodized, deburred and polished pieces are strong and safe to work with. Note: Our new colors are now in stock !",
    "productUrl": "https://www.studica.com/96mm-adjustable-flat-bracket-2-pack-2",
    "imageUrl": "https://www.studica.com/images/thumbs/0018091_96mm-adjustable-flat-bracket_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76084",
    "name": "T Bracket (Blue)",
    "sku": "76084",
    "category": "Robot Parts",
    "description": "T Bracket (Blue) · $6.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/t-bracket-blue-2",
    "imageUrl": "https://www.studica.com/images/thumbs/0017774_t-bracket-blue_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76084-bk",
    "name": "T Bracket (Black)",
    "sku": "76084-bk",
    "category": "Robot Parts",
    "description": "T Bracket (Black) · $6.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/t-bracket-black",
    "imageUrl": "https://www.studica.com/images/thumbs/0016765_t-bracket-black_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76084-cl",
    "name": "T Bracket (Silver)",
    "sku": "76084-cl",
    "category": "Robot Parts",
    "description": "T Bracket (Silver) · $4.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/t-bracket-clear",
    "imageUrl": "https://www.studica.com/images/thumbs/0016761_t-bracket-silver_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76084-gd",
    "name": "T Bracket (Gold)",
    "sku": "76084-gd",
    "category": "Robot Parts",
    "description": "T Bracket (Gold) · $6.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/t-bracket-gold",
    "imageUrl": "https://www.studica.com/images/thumbs/0016762_t-bracket-gold_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76084-gn",
    "name": "T Bracket (Green)",
    "sku": "76084-gn",
    "category": "Robot Parts",
    "description": "T Bracket (Green) · $6.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/t-bracket-green",
    "imageUrl": "https://www.studica.com/images/thumbs/0016763_t-bracket-green_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76084-rd",
    "name": "T Bracket (Red)",
    "sku": "76084-rd",
    "category": "Robot Parts",
    "description": "T Bracket (Red) · $6.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/t-bracket-red",
    "imageUrl": "https://www.studica.com/images/thumbs/0016764_t-bracket-red_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76084gp",
    "name": "T Bracket",
    "sku": "76084GP",
    "category": "Robot Parts",
    "description": "T Bracket · price not listed · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics T Bracket is ideal for connecting two or three channels together. Each side is 48mm wide to fit on a U-Channel, low profile channel or other brackets. The overall size is 144mm x 96mm. Now available in six different colors. These anodized, deburred and polished pieces are strong and safe to work with. Note: Our new colors are now in stock !",
    "productUrl": "https://www.studica.com/t-bracket-2-pack-2",
    "imageUrl": "https://www.studica.com/images/thumbs/0017999_t-bracket_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76085",
    "name": "X Bracket (Blue)",
    "sku": "76085",
    "category": "Robot Parts",
    "description": "X Bracket (Blue) · $8.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/x-bracket-blue-2",
    "imageUrl": "https://www.studica.com/images/thumbs/0017775_x-bracket-blue_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76085-bk",
    "name": "X Bracket (Black)",
    "sku": "76085-bk",
    "category": "Robot Parts",
    "description": "X Bracket (Black) · $8.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/x-bracket-black",
    "imageUrl": "https://www.studica.com/images/thumbs/0016753_x-bracket-black_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76085-cl",
    "name": "X Bracket (Silver)",
    "sku": "76085-cl",
    "category": "Robot Parts",
    "description": "X Bracket (Silver) · $5.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/x-bracket-clear",
    "imageUrl": "https://www.studica.com/images/thumbs/0016749_x-bracket-silver_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76085-gd",
    "name": "X Bracket (Gold)",
    "sku": "76085-gd",
    "category": "Robot Parts",
    "description": "X Bracket (Gold) · $8.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/x-bracket-gold",
    "imageUrl": "https://www.studica.com/images/thumbs/0016750_x-bracket-gold_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76085-gn",
    "name": "X Bracket (Green)",
    "sku": "76085-gn",
    "category": "Robot Parts",
    "description": "X Bracket (Green) · $8.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/x-bracket-green",
    "imageUrl": "https://www.studica.com/images/thumbs/0016751_x-bracket-green_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76085-rd",
    "name": "X Bracket (Red)",
    "sku": "76085-rd",
    "category": "Robot Parts",
    "description": "X Bracket (Red) · $8.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/x-bracket-red",
    "imageUrl": "https://www.studica.com/images/thumbs/0016752_x-bracket-red_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76085gp",
    "name": "X Bracket",
    "sku": "76085GP",
    "category": "Robot Parts",
    "description": "X Bracket · price not listed · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics X Bracket is perfect for connecting four channels pieces together. Each of the 4 sections is 48mm wide and the overall dimensions are 144mm x 144mm. Now available in six different colors. These anodized, deburred and polished pieces are strong and safe to work with. Note: Our new colors are now in stock !",
    "productUrl": "https://www.studica.com/x-bracket-2",
    "imageUrl": "https://www.studica.com/images/thumbs/0018000_x-bracket_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76086",
    "name": "Inside U-Bracket (Blue)",
    "sku": "76086",
    "category": "Robot Parts",
    "description": "Inside U-Bracket (Blue) · $4.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/inside-u-bracket-blue-2",
    "imageUrl": "https://www.studica.com/images/thumbs/0017773_inside-u-bracket-blue_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76086-bk",
    "name": "Inside U Bracket (Black)",
    "sku": "76086-bk",
    "category": "Robot Parts",
    "description": "Inside U Bracket (Black) · $4.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/inside-u-bracket-black",
    "imageUrl": "https://www.studica.com/images/thumbs/0016793_inside-u-bracket-black_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76086-cl",
    "name": "Inside U Bracket (Silver)",
    "sku": "76086-cl",
    "category": "Robot Parts",
    "description": "Inside U Bracket (Silver) · $2.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/inside-u-bracket-clear",
    "imageUrl": "https://www.studica.com/images/thumbs/0016789_inside-u-bracket-silver_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76086-gd",
    "name": "Inside U Bracket (Gold)",
    "sku": "76086-gd",
    "category": "Robot Parts",
    "description": "Inside U Bracket (Gold) · $4.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/inside-u-bracket-gold",
    "imageUrl": "https://www.studica.com/images/thumbs/0016790_inside-u-bracket-gold_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76086-gn",
    "name": "Inside U Bracket (Green)",
    "sku": "76086-gn",
    "category": "Robot Parts",
    "description": "Inside U Bracket (Green) · $4.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/inside-u-bracket-green",
    "imageUrl": "https://www.studica.com/images/thumbs/0016791_inside-u-bracket-green_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76086-rd",
    "name": "Inside U Bracket (Red)",
    "sku": "76086-rd",
    "category": "Robot Parts",
    "description": "Inside U Bracket (Red) · $4.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/inside-u-bracket-red",
    "imageUrl": "https://www.studica.com/images/thumbs/0016792_inside-u-bracket-red_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76086gp",
    "name": "Inside U-Bracket",
    "sku": "76086GP",
    "category": "Robot Parts",
    "description": "Inside U-Bracket · price not listed · Studica Robot Parts listing (collected Oct 2026) · Made from 3mm thick heavy 6061-T6 Aluminum, the Studica Robotics Inside U Bracket (available in six different colors) is 42mm x 45mm and is used inside a U-Channel or Low profile channel. As with the other Studica Robotics building components, it has the common hole pattern which makes it easy to connect to other structure with very little or no additional machining required. You can easily connect to other channel, extrusions, bushings, bearing, mounting brackets and more so you can quickly ass",
    "productUrl": "https://www.studica.com/inside-u-bracket-2",
    "imageUrl": "https://www.studica.com/images/thumbs/0018098_inside-u-bracket_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76087",
    "name": "L Bracket (Blue)",
    "sku": "76087",
    "category": "Robot Parts",
    "description": "L Bracket (Blue) · $3.59 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/l-bracket-blue",
    "imageUrl": "https://www.studica.com/images/thumbs/0017503_l-bracket-blue_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76087-bk",
    "name": "L Bracket (Black)",
    "sku": "76087-bk",
    "category": "Robot Parts",
    "description": "L Bracket (Black) · $3.59 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/l-bracket-black",
    "imageUrl": "https://www.studica.com/images/thumbs/0017508_l-bracket-black_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76087-cl",
    "name": "L Bracket (Silver)",
    "sku": "76087-cl",
    "category": "Robot Parts",
    "description": "L Bracket (Silver) · $2.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/l-bracket-clear",
    "imageUrl": "https://www.studica.com/images/thumbs/0017504_l-bracket-silver_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76087-gd",
    "name": "L Bracket (Gold)",
    "sku": "76087-gd",
    "category": "Robot Parts",
    "description": "L Bracket (Gold) · $3.59 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/l-bracket-gold",
    "imageUrl": "https://www.studica.com/images/thumbs/0017505_l-bracket-gold_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76087-gn",
    "name": "L Bracket (Green)",
    "sku": "76087-gn",
    "category": "Robot Parts",
    "description": "L Bracket (Green) · $3.59 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/l-bracket-green",
    "imageUrl": "https://www.studica.com/images/thumbs/0017506_l-bracket-green_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76087-rd",
    "name": "L Bracket (Red)",
    "sku": "76087-rd",
    "category": "Robot Parts",
    "description": "L Bracket (Red) · $3.59 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/l-bracket-red",
    "imageUrl": "https://www.studica.com/images/thumbs/0017507_l-bracket-red_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76087gp",
    "name": "L Bracket",
    "sku": "76087GP",
    "category": "Robot Parts",
    "description": "L Bracket · price not listed · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics L-bracket is made from 3mm thick, 6061-T6 Aluminum, with a length and width of 48mm x 48mm. The L-bracket is used outside a U-Channel or Low profile channel. As with the other Studica Robotics building components, it has the common hole pattern which makes it easy to connect to other structure with very little or no additional machining required. Now available in a variety of colors. These anodized, deburred and polished pieces are strong and safe to work with. Note: Our new",
    "productUrl": "https://www.studica.com/l-bracket-2-pack-2",
    "imageUrl": "https://www.studica.com/images/thumbs/0018100_l-bracket_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76089",
    "name": "Inside L Bracket (Blue)",
    "sku": "76089",
    "category": "Robot Parts",
    "description": "Inside L Bracket (Blue) · $3.59 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/inside-l-bracket-blue-2",
    "imageUrl": "https://www.studica.com/images/thumbs/0017772_inside-l-bracket-blue_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76089-bk",
    "name": "Inside L Bracket (Black)",
    "sku": "76089-bk",
    "category": "Robot Parts",
    "description": "Inside L Bracket (Black) · $3.59 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/inside-l-bracket-black-2",
    "imageUrl": "https://www.studica.com/images/thumbs/0016805_inside-l-bracket-black_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76089-cl",
    "name": "Inside L Bracket (Silver)",
    "sku": "76089-cl",
    "category": "Robot Parts",
    "description": "Inside L Bracket (Silver) · $2.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/inside-l-bracket-clear",
    "imageUrl": "https://www.studica.com/images/thumbs/0016801_inside-l-bracket-silver_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76089-gd",
    "name": "Inside L Bracket (Gold)",
    "sku": "76089-gd",
    "category": "Robot Parts",
    "description": "Inside L Bracket (Gold) · $3.59 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/inside-l-bracket-gold",
    "imageUrl": "https://www.studica.com/images/thumbs/0016802_inside-l-bracket-gold_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76089-gn",
    "name": "Inside L Bracket (Green)",
    "sku": "76089-gn",
    "category": "Robot Parts",
    "description": "Inside L Bracket (Green) · $3.59 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/inside-l-bracket-green-2",
    "imageUrl": "https://www.studica.com/images/thumbs/0016803_inside-l-bracket-green_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76089-rd",
    "name": "Inside L Bracket (Red)",
    "sku": "76089-rd",
    "category": "Robot Parts",
    "description": "Inside L Bracket (Red) · $3.59 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/inside-l-bracket-red",
    "imageUrl": "https://www.studica.com/images/thumbs/0016804_inside-l-bracket-red_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76089gp",
    "name": "Inside L Bracket",
    "sku": "76089GP",
    "category": "Robot Parts",
    "description": "Inside L Bracket · price not listed · Studica Robot Parts listing (collected Oct 2026) · Made from 3mm thick 6061-T6 Aluminum, available in six different colors, the Studica Robotics Inside L Bracket is 42mm x 45mm and is used inside a U-Channel or Low profile channel. As with the other Studica Robotics building components, it has the common hole pattern which makes it easy to connect to other structure with very little or no additional machining required. These anodized, deburred and polished pieces are strong and safe to work with. Note: Our new colors are now in stock !",
    "productUrl": "https://www.studica.com/inside-l-bracket-2-pack-2",
    "imageUrl": "https://www.studica.com/images/thumbs/0018101_inside-l-bracket_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76100",
    "name": "432mm Square Beam (Blue)",
    "sku": "76100",
    "category": "Robot Parts",
    "description": "432mm Square Beam (Blue) · $18.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/432mm-square-beam-blue",
    "imageUrl": "https://www.studica.com/images/thumbs/0017133_432mm-square-beam-blue_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76100-bk",
    "name": "432mm Square Beam (Black)",
    "sku": "76100-bk",
    "category": "Robot Parts",
    "description": "432mm Square Beam (Black) · $18.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/432mm-square-beam-black",
    "imageUrl": "https://www.studica.com/images/thumbs/0017138_432mm-square-beam-black_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76100-cl",
    "name": "432mm Square Beam (Silver)",
    "sku": "76100-cl",
    "category": "Robot Parts",
    "description": "432mm Square Beam (Silver) · $11.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/432mm-square-beam-clear",
    "imageUrl": "https://www.studica.com/images/thumbs/0017134_432mm-square-beam-silver_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76100-gd",
    "name": "432mm Square Beam (Gold)",
    "sku": "76100-gd",
    "category": "Robot Parts",
    "description": "432mm Square Beam (Gold) · $18.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/432mm-square-beam-gold",
    "imageUrl": "https://www.studica.com/images/thumbs/0017135_432mm-square-beam-gold_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76100-gn",
    "name": "432mm Square Beam (Green)",
    "sku": "76100-gn",
    "category": "Robot Parts",
    "description": "432mm Square Beam (Green) · $18.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/432mm-square-beam-green",
    "imageUrl": "https://www.studica.com/images/thumbs/0017136_432mm-square-beam-green_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76100-rd",
    "name": "432mm Square Beam (Red)",
    "sku": "76100-rd",
    "category": "Robot Parts",
    "description": "432mm Square Beam (Red) · $18.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/432mm-square-beam-red",
    "imageUrl": "https://www.studica.com/images/thumbs/0017137_432mm-square-beam-red_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76100gp",
    "name": "432mm Square Beam",
    "sku": "76100GP",
    "category": "Robot Parts",
    "description": "432mm Square Beam · price not listed · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 432mm Square Beam, available in six different colors, is 8mm by 8mm. As with the other Studica Robotics building components, it has the common hole pattern which makes it easy to connect to other structure with very little or no additional machining required. These anodized, deburred and polished pieces are strong and safe to work with. Note: Our new colors are now in stock !",
    "productUrl": "https://www.studica.com/432mm-square-beam-3",
    "imageUrl": "https://www.studica.com/images/thumbs/0018145_432mm-square-beam_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76101",
    "name": "384mm Square Beam (Blue)",
    "sku": "76101",
    "category": "Robot Parts",
    "description": "384mm Square Beam (Blue) · $14.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/384mm-square-beam-blue",
    "imageUrl": "https://www.studica.com/images/thumbs/0017121_384mm-square-beam-blue_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76101-bk",
    "name": "384mm Square Beam (Black)",
    "sku": "76101-bk",
    "category": "Robot Parts",
    "description": "384mm Square Beam (Black) · $14.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/384mm-square-beam-black",
    "imageUrl": "https://www.studica.com/images/thumbs/0017126_384mm-square-beam-black_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76101-cl",
    "name": "384mm Square Beam (Silver)",
    "sku": "76101-cl",
    "category": "Robot Parts",
    "description": "384mm Square Beam (Silver) · $9.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/384mm-square-beam-clear",
    "imageUrl": "https://www.studica.com/images/thumbs/0017122_384mm-square-beam-silver_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76101-gd",
    "name": "384mm Square Beam (Gold)",
    "sku": "76101-gd",
    "category": "Robot Parts",
    "description": "384mm Square Beam (Gold) · $14.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/384mm-square-beam-gold",
    "imageUrl": "https://www.studica.com/images/thumbs/0017123_384mm-square-beam-gold_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76101-gn",
    "name": "384mm Square Beam (Green)",
    "sku": "76101-gn",
    "category": "Robot Parts",
    "description": "384mm Square Beam (Green) · $14.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/384mm-square-beam-green",
    "imageUrl": "https://www.studica.com/images/thumbs/0017124_384mm-square-beam-green_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76101-rd",
    "name": "384mm Square Beam (Red)",
    "sku": "76101-rd",
    "category": "Robot Parts",
    "description": "384mm Square Beam (Red) · $14.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/384mm-square-beam-red",
    "imageUrl": "https://www.studica.com/images/thumbs/0017125_384mm-square-beam-red_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76101gp",
    "name": "384mm Square Beam",
    "sku": "76101GP",
    "category": "Robot Parts",
    "description": "384mm Square Beam · price not listed · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 384mm Square Beam, available in six different colors, is 8mm by 8mm. As with the other Studica Robotics building components, it has the common hole pattern which makes it easy to connect to other structure with very little or no additional machining required. You can easily connect to other channel, extrusions, bushings, bearing, mounting brackets and more so you can quickly assemble and disassemble robots and automated systems. Ideal for rapid prototyping. These anodized, d",
    "productUrl": "https://www.studica.com/384mm-square-beam-3",
    "imageUrl": "https://www.studica.com/images/thumbs/0018144_384mm-square-beam_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76102",
    "name": "336mm Square Beam (Blue)",
    "sku": "76102",
    "category": "Robot Parts",
    "description": "336mm Square Beam (Blue) · $13.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/336mm-square-beam-blue",
    "imageUrl": "https://www.studica.com/images/thumbs/0017109_336mm-square-beam-blue_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76102-bk",
    "name": "336mm Square Beam (Black)",
    "sku": "76102-bk",
    "category": "Robot Parts",
    "description": "336mm Square Beam (Black) · $13.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/336mm-square-beam-black",
    "imageUrl": "https://www.studica.com/images/thumbs/0017114_336mm-square-beam-black_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76102-cl",
    "name": "336mm Square Beam (Silver)",
    "sku": "76102-cl",
    "category": "Robot Parts",
    "description": "336mm Square Beam (Silver) · $8.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/336mm-square-beam-clear-2",
    "imageUrl": "https://www.studica.com/images/thumbs/0017110_336mm-square-beam-silver_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76102-gd",
    "name": "336mm Square Beam (Gold)",
    "sku": "76102-gd",
    "category": "Robot Parts",
    "description": "336mm Square Beam (Gold) · $13.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/336mm-square-beam-gold",
    "imageUrl": "https://www.studica.com/images/thumbs/0017111_336mm-square-beam-gold_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76102-gn",
    "name": "336mm Square Beam (Green)",
    "sku": "76102-gn",
    "category": "Robot Parts",
    "description": "336mm Square Beam (Green) · $13.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/336mm-square-beam-green",
    "imageUrl": "https://www.studica.com/images/thumbs/0017112_336mm-square-beam-green_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76102-rd",
    "name": "336mm Square Beam (Red)",
    "sku": "76102-rd",
    "category": "Robot Parts",
    "description": "336mm Square Beam (Red) · $13.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/336mm-square-beam-red",
    "imageUrl": "https://www.studica.com/images/thumbs/0017113_336mm-square-beam-red_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76102gp",
    "name": "336mm Square Beam",
    "sku": "76102GP",
    "category": "Robot Parts",
    "description": "336mm Square Beam · price not listed · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 336mm Square Beam, available in six different colors, is 8mm by 8mm. As with the other Studica Robotics building components, it has the common hole pattern which makes it easy to connect to other structure with very little or no additional machining required. You can easily connect to other channel, extrusions, bushings, bearing, mounting brackets and more so you can quickly assemble and disassemble robots and automated systems. Ideal for rapid prototyping. These anodized, d",
    "productUrl": "https://www.studica.com/336mm-square-beam-3",
    "imageUrl": "https://www.studica.com/images/thumbs/0018143_336mm-square-beam_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76103",
    "name": "288mm Square Beam (Blue)",
    "sku": "76103",
    "category": "Robot Parts",
    "description": "288mm Square Beam (Blue) · $12.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/288mm-square-beam-blue",
    "imageUrl": "https://www.studica.com/images/thumbs/0017097_288mm-square-beam-blue_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76103-bk",
    "name": "288mm Square Beam (Black)",
    "sku": "76103-bk",
    "category": "Robot Parts",
    "description": "288mm Square Beam (Black) · $12.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/288mm-square-beam-black",
    "imageUrl": "https://www.studica.com/images/thumbs/0017102_288mm-square-beam-black_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76103-cl",
    "name": "288mm Square Beam (Silver)",
    "sku": "76103-cl",
    "category": "Robot Parts",
    "description": "288mm Square Beam (Silver) · $12.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/288mm-square-beam-clear",
    "imageUrl": "https://www.studica.com/images/thumbs/0017098_288mm-square-beam-silver_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76103-gd",
    "name": "288mm Square Beam (Gold)",
    "sku": "76103-gd",
    "category": "Robot Parts",
    "description": "288mm Square Beam (Gold) · $12.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/288mm-square-beam-gold",
    "imageUrl": "https://www.studica.com/images/thumbs/0017099_288mm-square-beam-gold_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76103-gn",
    "name": "288mm Square Beam (Green)",
    "sku": "76103-gn",
    "category": "Robot Parts",
    "description": "288mm Square Beam (Green) · $12.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/288mm-square-beam-green",
    "imageUrl": "https://www.studica.com/images/thumbs/0017100_288mm-square-beam-green_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76103-rd",
    "name": "288mm Square Beam (Red)",
    "sku": "76103-rd",
    "category": "Robot Parts",
    "description": "288mm Square Beam (Red) · $12.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/288mm-square-beam-red",
    "imageUrl": "https://www.studica.com/images/thumbs/0017101_288mm-square-beam-red_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76103gp",
    "name": "288mm Square Beam",
    "sku": "76103GP",
    "category": "Robot Parts",
    "description": "288mm Square Beam · price not listed · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 288mm Square Beam, available in six different colors, is 8mm by 8mm. These anodized, deburred and polished pieces are strong and safe to work with. Note: Our new colors are now in stock !",
    "productUrl": "https://www.studica.com/288mm-square-beam-3",
    "imageUrl": "https://www.studica.com/images/thumbs/0018140_288mm-square-beam_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76104",
    "name": "240mm Square Beam (Blue)",
    "sku": "76104",
    "category": "Robot Parts",
    "description": "240mm Square Beam (Blue) · $10.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/240mm-square-beam-blue",
    "imageUrl": "https://www.studica.com/images/thumbs/0017085_240mm-square-beam-blue_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76104-bk",
    "name": "240mm Square Beam (Black)",
    "sku": "76104-bk",
    "category": "Robot Parts",
    "description": "240mm Square Beam (Black) · $10.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/240mm-square-beam-black",
    "imageUrl": "https://www.studica.com/images/thumbs/0017090_240mm-square-beam-black_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76104-cl",
    "name": "240mm Square Beam (Silver)",
    "sku": "76104-cl",
    "category": "Robot Parts",
    "description": "240mm Square Beam (Silver) · $10.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/240mm-square-beam-clear",
    "imageUrl": "https://www.studica.com/images/thumbs/0017086_240mm-square-beam-silver_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76104-gd",
    "name": "240mm Square Beam (Gold)",
    "sku": "76104-gd",
    "category": "Robot Parts",
    "description": "240mm Square Beam (Gold) · $10.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/240mm-square-beam-gold",
    "imageUrl": "https://www.studica.com/images/thumbs/0017087_240mm-square-beam-gold_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76104-gn",
    "name": "240mm Square Beam (Green)",
    "sku": "76104-gn",
    "category": "Robot Parts",
    "description": "240mm Square Beam (Green) · $10.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/240mm-square-beam-green",
    "imageUrl": "https://www.studica.com/images/thumbs/0017088_240mm-square-beam-green_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76104-rd",
    "name": "240mm Square Beam (Red)",
    "sku": "76104-rd",
    "category": "Robot Parts",
    "description": "240mm Square Beam (Red) · $10.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/240mm-square-beam-red",
    "imageUrl": "https://www.studica.com/images/thumbs/0017089_240mm-square-beam-red_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76104gp",
    "name": "240mm Square Beam",
    "sku": "76104GP",
    "category": "Robot Parts",
    "description": "240mm Square Beam · price not listed · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 240mm Square Beam, available in six different colors, is 8mm by 8mm. As with the other Studica Robotics building components, it has the common hole pattern which makes it easy to connect to other structure with very little or no additional machining required. These anodized, deburred and polished pieces are strong and safe to work with. Note: Our new colors are now in stock !",
    "productUrl": "https://www.studica.com/240mm-square-beam-3",
    "imageUrl": "https://www.studica.com/images/thumbs/0018139_240mm-square-beam_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76105",
    "name": "192mm Square Beam (Blue)",
    "sku": "76105",
    "category": "Robot Parts",
    "description": "192mm Square Beam (Blue) · $10.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/192mm-square-beam-blue",
    "imageUrl": "https://www.studica.com/images/thumbs/0017073_192mm-square-beam-blue_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76105-bk",
    "name": "192mm Square Beam (Black)",
    "sku": "76105-bk",
    "category": "Robot Parts",
    "description": "192mm Square Beam (Black) · $10.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/192mm-square-beam-black-2",
    "imageUrl": "https://www.studica.com/images/thumbs/0017078_192mm-square-beam-black_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76105-cl",
    "name": "192mm Square Beam (Silver)",
    "sku": "76105-cl",
    "category": "Robot Parts",
    "description": "192mm Square Beam (Silver) · $10.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/192mm-square-beam-clear",
    "imageUrl": "https://www.studica.com/images/thumbs/0017074_192mm-square-beam-silver_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76105-gd",
    "name": "192mm Square Beam (Gold)",
    "sku": "76105-gd",
    "category": "Robot Parts",
    "description": "192mm Square Beam (Gold) · $10.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/192mm-square-beam-gold",
    "imageUrl": "https://www.studica.com/images/thumbs/0017075_192mm-square-beam-gold_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76105-gn",
    "name": "192mm Square Beam (Green)",
    "sku": "76105-gn",
    "category": "Robot Parts",
    "description": "192mm Square Beam (Green) · $10.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/192mm-square-beam-green",
    "imageUrl": "https://www.studica.com/images/thumbs/0017076_192mm-square-beam-green_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76105-rd",
    "name": "192mm Square Beam (Red)",
    "sku": "76105-rd",
    "category": "Robot Parts",
    "description": "192mm Square Beam (Red) · $10.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/192mm-square-beam-red",
    "imageUrl": "https://www.studica.com/images/thumbs/0017077_192mm-square-beam-red_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76105gp",
    "name": "192mm Square Beam",
    "sku": "76105GP",
    "category": "Robot Parts",
    "description": "192mm Square Beam · price not listed · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 192mm Square Beam is 8mm by 8mm and is part of our colored structure collection . As with the other Studica Robotics building components, it has the common hole pattern which makes it easy to connect to other structure with very little or no additional machining required. You can easily connect to other channel, extrusions, bushings, bearing, mounting brackets and more so you can quickly assemble and disassemble robots and automated systems. Ideal for rapid prototyping. Note",
    "productUrl": "https://www.studica.com/192mm-square-beam-3",
    "imageUrl": "https://www.studica.com/images/thumbs/0018138_192mm-square-beam_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76106",
    "name": "144mm Square Beam (Blue)",
    "sku": "76106",
    "category": "Robot Parts",
    "description": "144mm Square Beam (Blue) · $7.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/144mm-square-beam-blue",
    "imageUrl": "https://www.studica.com/images/thumbs/0017061_144mm-square-beam-blue_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76106-bk",
    "name": "144mm Square Beam (Black)",
    "sku": "76106-bk",
    "category": "Robot Parts",
    "description": "144mm Square Beam (Black) · $7.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/144mm-square-beam-black",
    "imageUrl": "https://www.studica.com/images/thumbs/0017066_144mm-square-beam-black_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76106-cl",
    "name": "144mm Square Beam (Silver)",
    "sku": "76106-cl",
    "category": "Robot Parts",
    "description": "144mm Square Beam (Silver) · $7.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/144mm-square-beam-clear",
    "imageUrl": "https://www.studica.com/images/thumbs/0017062_144mm-square-beam-silver_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76106-gd",
    "name": "144mm Square Beam (Gold)",
    "sku": "76106-gd",
    "category": "Robot Parts",
    "description": "144mm Square Beam (Gold) · $7.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/144mm-square-beam-gold",
    "imageUrl": "https://www.studica.com/images/thumbs/0017063_144mm-square-beam-gold_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76106-gn",
    "name": "144mm Square Beam (Green)",
    "sku": "76106-gn",
    "category": "Robot Parts",
    "description": "144mm Square Beam (Green) · $7.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/144mm-square-beam-green",
    "imageUrl": "https://www.studica.com/images/thumbs/0017064_144mm-square-beam-green_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76106-rd",
    "name": "144mm Square Beam (Red)",
    "sku": "76106-rd",
    "category": "Robot Parts",
    "description": "144mm Square Beam (Red) · $7.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/144mm-square-beam-red",
    "imageUrl": "https://www.studica.com/images/thumbs/0017065_144mm-square-beam-red_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76106gp",
    "name": "144mm Square Beam",
    "sku": "76106GP",
    "category": "Robot Parts",
    "description": "144mm Square Beam · price not listed · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 144mm Square Beam, available in six different colors, is 8mm by 8mm. As with the other Studica Robotics building components, it has the common hole pattern which makes it easy to connect to other structure with very little or no additional machining required. These anodized, deburred and polished pieces are strong and safe to work with. Note: Our new colors are now in stock !",
    "productUrl": "https://www.studica.com/144mm-square-beam-3",
    "imageUrl": "https://www.studica.com/images/thumbs/0018137_144mm-square-beam_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76107",
    "name": "96mm Square Beam (Blue)",
    "sku": "76107",
    "category": "Robot Parts",
    "description": "96mm Square Beam (Blue) · $5.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/96mm-square-beam-blue",
    "imageUrl": "https://www.studica.com/images/thumbs/0017157_96mm-square-beam-blue_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76107-bk",
    "name": "96mm Square Beam (Black)",
    "sku": "76107-bk",
    "category": "Robot Parts",
    "description": "96mm Square Beam (Black) · $5.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/96mm-square-beam-black",
    "imageUrl": "https://www.studica.com/images/thumbs/0017162_96mm-square-beam-black_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76107-cl",
    "name": "96mm Square Beam (Silver)",
    "sku": "76107-cl",
    "category": "Robot Parts",
    "description": "96mm Square Beam (Silver) · $5.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/96mm-square-beam-clear",
    "imageUrl": "https://www.studica.com/images/thumbs/0017158_96mm-square-beam-silver_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76107-gd",
    "name": "96mm Square Beam (Gold)",
    "sku": "76107-gd",
    "category": "Robot Parts",
    "description": "96mm Square Beam (Gold) · $5.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/96mm-square-beam-gold",
    "imageUrl": "https://www.studica.com/images/thumbs/0017159_96mm-square-beam-gold_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76107-gn",
    "name": "96mm Square Beam (Green)",
    "sku": "76107-gn",
    "category": "Robot Parts",
    "description": "96mm Square Beam (Green) · $5.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/96mm-square-beam-green",
    "imageUrl": "https://www.studica.com/images/thumbs/0017160_96mm-square-beam-green_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76107-rd",
    "name": "96mm Square Beam (Red)",
    "sku": "76107-rd",
    "category": "Robot Parts",
    "description": "96mm Square Beam (Red) · $5.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/96mm-square-beam-red",
    "imageUrl": "https://www.studica.com/images/thumbs/0017161_96mm-square-beam-red_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76107gp",
    "name": "96mm Square Beam",
    "sku": "76107GP",
    "category": "Robot Parts",
    "description": "96mm Square Beam · price not listed · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 96mm Square Beam, available in six different colors, is 8mm by 8mm. As with the other Studica Robotics building components, it has the common hole pattern which makes it easy to connect to other structure with very little or no additional machining required. These anodized, deburred and polished pieces are strong and safe to work with. Note: Our new colors are now in stock !",
    "productUrl": "https://www.studica.com/96mm-square-beam-3",
    "imageUrl": "https://www.studica.com/images/thumbs/0018136_96mm-square-beam_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76108",
    "name": "48mm Square Beam (Blue)",
    "sku": "76108",
    "category": "Robot Parts",
    "description": "48mm Square Beam (Blue) · $3.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/48mm-square-beam-blue",
    "imageUrl": "https://www.studica.com/images/thumbs/0017145_48mm-square-beam-blue_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76108-bk",
    "name": "48mm Square Beam (Black)",
    "sku": "76108-bk",
    "category": "Robot Parts",
    "description": "48mm Square Beam (Black) · $3.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/48mm-square-beam-black",
    "imageUrl": "https://www.studica.com/images/thumbs/0017150_48mm-square-beam-black_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76108-cl",
    "name": "48mm Square Beam (Silver)",
    "sku": "76108-cl",
    "category": "Robot Parts",
    "description": "48mm Square Beam (Silver) · $3.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/48mm-square-beam-clear",
    "imageUrl": "https://www.studica.com/images/thumbs/0017146_48mm-square-beam-silver_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76108-gd",
    "name": "48mm Square Beam (Gold)",
    "sku": "76108-gd",
    "category": "Robot Parts",
    "description": "48mm Square Beam (Gold) · $3.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/48mm-square-beam-gold-2",
    "imageUrl": "https://www.studica.com/images/thumbs/0017147_48mm-square-beam-gold_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76108-gn",
    "name": "48mm Square Beam (Green)",
    "sku": "76108-gn",
    "category": "Robot Parts",
    "description": "48mm Square Beam (Green) · $3.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/48mm-square-beam-green",
    "imageUrl": "https://www.studica.com/images/thumbs/0017148_48mm-square-beam-green_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76108-rd",
    "name": "48mm Square Beam (Red)",
    "sku": "76108-rd",
    "category": "Robot Parts",
    "description": "48mm Square Beam (Red) · $3.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/48mm-square-beam-red",
    "imageUrl": "https://www.studica.com/images/thumbs/0017149_48mm-square-beam-red_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76108gp",
    "name": "48mm Square Beam",
    "sku": "76108GP",
    "category": "Robot Parts",
    "description": "48mm Square Beam · price not listed · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 48mm Square Beam, available in six different colors, is 8mm by 8mm. As with the other Studica Robotics building components, it has the common hole pattern which makes it easy to connect to other structure with very little or no additional machining required. These anodized, deburred and polished pieces are strong and safe to work with. Note: Our new colors are now in stock !",
    "productUrl": "https://www.studica.com/48mm-square-beam-3",
    "imageUrl": "https://www.studica.com/images/thumbs/0018135_48mm-square-beam_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76110",
    "name": "432mm L-Beam (Blue)",
    "sku": "76110",
    "category": "Robot Parts",
    "description": "432mm L-Beam (Blue) · $4.39 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/432mm-l-beam-blue-2",
    "imageUrl": "https://www.studica.com/images/thumbs/0017776_432mm-l-beam-blue_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76110-bk",
    "name": "432mm L-Beam (Black)",
    "sku": "76110-bk",
    "category": "Robot Parts",
    "description": "432mm L-Beam (Black) · $4.39 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/432mm-l-beam-black",
    "imageUrl": "https://www.studica.com/images/thumbs/0017030_432mm-l-beam-black_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76110-cl",
    "name": "432mm L-Beam (Silver)",
    "sku": "76110-cl",
    "category": "Robot Parts",
    "description": "432mm L-Beam (Silver) · $4.39 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/432mm-l-beam-clear",
    "imageUrl": "https://www.studica.com/images/thumbs/0017026_432mm-l-beam-silver_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76110-gd",
    "name": "432mm L-Beam (Gold)",
    "sku": "76110-gd",
    "category": "Robot Parts",
    "description": "432mm L-Beam (Gold) · $4.39 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/432mm-l-beam-gold",
    "imageUrl": "https://www.studica.com/images/thumbs/0017027_432mm-l-beam-gold_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76110-gn",
    "name": "432mm L-Beam (Green)",
    "sku": "76110-gn",
    "category": "Robot Parts",
    "description": "432mm L-Beam (Green) · $4.39 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/432mm-l-beam-green",
    "imageUrl": "https://www.studica.com/images/thumbs/0017028_432mm-l-beam-green_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76110-rd",
    "name": "432mm L-Beam (Red)",
    "sku": "76110-rd",
    "category": "Robot Parts",
    "description": "432mm L-Beam (Red) · $4.39 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/432mm-l-beam-red",
    "imageUrl": "https://www.studica.com/images/thumbs/0017029_432mm-l-beam-red_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76110gp",
    "name": "432mm L-Beam",
    "sku": "76110GP",
    "category": "Robot Parts",
    "description": "432mm L-Beam · price not listed · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 432mm L-Beam, available in six different colors, has a width and height of 14mm. It is strong while light weight. It can be easily cut to your own custom size. The hole pattern matches the hole patterns in the Studica U-Channel, Low Profile U-Channel, and the various plates. Ideal for rapid prototyping. These anodized, deburred and polished pieces are strong and safe to work with. Note: Our new colors are now in stock !",
    "productUrl": "https://www.studica.com/432mm-l-beam-2-pack-2",
    "imageUrl": "https://www.studica.com/images/thumbs/0018110_432mm-l-beam_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76111",
    "name": "384mm L-Beam (Blue)",
    "sku": "76111",
    "category": "Robot Parts",
    "description": "384mm L-Beam (Blue) · $3.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/384mm-l-beam-blue-2",
    "imageUrl": "https://www.studica.com/images/thumbs/0017777_384mm-l-beam-blue_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76111-bk",
    "name": "384mm L-Beam (Black)",
    "sku": "76111-bk",
    "category": "Robot Parts",
    "description": "384mm L-Beam (Black) · $3.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/384mm-l-beam-black-2",
    "imageUrl": "https://www.studica.com/images/thumbs/0017018_384mm-l-beam-black_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76111-cl",
    "name": "384mm L-Beam (Silver)",
    "sku": "76111-cl",
    "category": "Robot Parts",
    "description": "384mm L-Beam (Silver) · $3.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/384mm-l-beam-clear",
    "imageUrl": "https://www.studica.com/images/thumbs/0017014_384mm-l-beam-silver_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76111-gd",
    "name": "384mm L-Beam (Gold)",
    "sku": "76111-gd",
    "category": "Robot Parts",
    "description": "384mm L-Beam (Gold) · $3.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/384mm-l-beam-gold",
    "imageUrl": "https://www.studica.com/images/thumbs/0017015_384mm-l-beam-gold_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76111-gn",
    "name": "384mm L-Beam (Green)",
    "sku": "76111-gn",
    "category": "Robot Parts",
    "description": "384mm L-Beam (Green) · $3.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/384mm-l-beam-green",
    "imageUrl": "https://www.studica.com/images/thumbs/0017016_384mm-l-beam-green_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76111-rd",
    "name": "384mm L-Beam (Red)",
    "sku": "76111-rd",
    "category": "Robot Parts",
    "description": "384mm L-Beam (Red) · $3.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/384mm-l-beam-red",
    "imageUrl": "https://www.studica.com/images/thumbs/0017017_384mm-l-beam-red_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76111gp",
    "name": "384mm L-Beam",
    "sku": "76111GP",
    "category": "Robot Parts",
    "description": "384mm L-Beam · price not listed · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 384mm L-Beam, available in six different colors, has a width and height of 14mm each. It is strong while light weight. It can be easily cut to your own custom size. The hole pattern matches the hole patterns in the Studica U-Channel, Low Profile U-Channel, and the various plates. Ideal for rapid prototyping. These anodized, deburred and polished pieces are strong and safe to work with. Note: Our new colors are now in stock !",
    "productUrl": "https://www.studica.com/384mm-l-beam-2-pack-2",
    "imageUrl": "https://www.studica.com/images/thumbs/0018109_384mm-l-beam_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76112",
    "name": "336mm L-Beam (Blue)",
    "sku": "76112",
    "category": "Robot Parts",
    "description": "336mm L-Beam (Blue) · $3.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/336mm-l-beam-blue-2",
    "imageUrl": "https://www.studica.com/images/thumbs/0017778_336mm-l-beam-blue_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76112-bk",
    "name": "336mm L-Beam (Black)",
    "sku": "76112-bk",
    "category": "Robot Parts",
    "description": "336mm L-Beam (Black) · $3.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/336mm-l-beam-black",
    "imageUrl": "https://www.studica.com/images/thumbs/0017006_336mm-l-beam-black_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76112-cl",
    "name": "336mm L-Beam (Silver)",
    "sku": "76112-cl",
    "category": "Robot Parts",
    "description": "336mm L-Beam (Silver) · $3.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/336mm-l-beam-clear",
    "imageUrl": "https://www.studica.com/images/thumbs/0017002_336mm-l-beam-silver_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76112-gd",
    "name": "336mm L-Beam (Gold)",
    "sku": "76112-gd",
    "category": "Robot Parts",
    "description": "336mm L-Beam (Gold) · $3.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/336mm-l-beam-gold",
    "imageUrl": "https://www.studica.com/images/thumbs/0017003_336mm-l-beam-gold_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76112-gn",
    "name": "336mm L-Beam (Green)",
    "sku": "76112-gn",
    "category": "Robot Parts",
    "description": "336mm L-Beam (Green) · $3.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/336mm-l-beam-green",
    "imageUrl": "https://www.studica.com/images/thumbs/0017004_336mm-l-beam-green_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76112-rd",
    "name": "336mm L-Beam (Red)",
    "sku": "76112-rd",
    "category": "Robot Parts",
    "description": "336mm L-Beam (Red) · $3.99 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/336mm-l-beam-red",
    "imageUrl": "https://www.studica.com/images/thumbs/0017005_336mm-l-beam-red_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76112gp",
    "name": "336mm L-Beam",
    "sku": "76112GP",
    "category": "Robot Parts",
    "description": "336mm L-Beam · price not listed · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 336mm L-Beam, available in six different colors, has a width and height of 14mm each. It is strong while light-weight. It can be easily cut to your own custom size. The hole pattern matches the hole patterns in the Studica U-Channel, Low Profile U-Channel, and the various plates. Ideal for rapid prototyping. These anodized, deburred and polished pieces are strong and safe to work with. Note: Our new colors are now in stock !",
    "productUrl": "https://www.studica.com/336mm-l-beam-2-pack-2",
    "imageUrl": "https://www.studica.com/images/thumbs/0018108_336mm-l-beam_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76113",
    "name": "288mm L-Beam (Blue)",
    "sku": "76113",
    "category": "Robot Parts",
    "description": "288mm L-Beam (Blue) · $3.59 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/288mm-l-beam-blue-2",
    "imageUrl": "https://www.studica.com/images/thumbs/0017779_288mm-l-beam-blue_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76113-bk",
    "name": "288mm L-Beam (Black)",
    "sku": "76113-bk",
    "category": "Robot Parts",
    "description": "288mm L-Beam (Black) · $3.59 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/288mm-l-beam-black",
    "imageUrl": "https://www.studica.com/images/thumbs/0016994_288mm-l-beam-black_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76113-cl",
    "name": "288mm L-Beam (Silver)",
    "sku": "76113-cl",
    "category": "Robot Parts",
    "description": "288mm L-Beam (Silver) · $3.59 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/288mm-l-beam-clear",
    "imageUrl": "https://www.studica.com/images/thumbs/0016990_288mm-l-beam-silver_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76113-gd",
    "name": "288mm L-Beam (Gold)",
    "sku": "76113-gd",
    "category": "Robot Parts",
    "description": "288mm L-Beam (Gold) · $3.59 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/288mm-l-beam-gold",
    "imageUrl": "https://www.studica.com/images/thumbs/0016991_288mm-l-beam-gold_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76113-gn",
    "name": "288mm L-Beam (Green)",
    "sku": "76113-gn",
    "category": "Robot Parts",
    "description": "288mm L-Beam (Green) · $3.59 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/288mm-l-beam-green",
    "imageUrl": "https://www.studica.com/images/thumbs/0016992_288mm-l-beam-green_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76113-rd",
    "name": "288mm L-Beam (Red)",
    "sku": "76113-rd",
    "category": "Robot Parts",
    "description": "288mm L-Beam (Red) · $3.59 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/288mm-l-beam-red",
    "imageUrl": "https://www.studica.com/images/thumbs/0016993_288mm-l-beam-red_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76113gp",
    "name": "288mm L-Beam",
    "sku": "76113GP",
    "category": "Robot Parts",
    "description": "288mm L-Beam · price not listed · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 288mm L-Beam, available in six different colors, has a width and height of 14mm each. It is strong while light-weight. It can be easily cut to your own custom size. The hole pattern matches the hole patterns in the Studica U-Channel, Low Profile U-Channel, and the various plates. Ideal for rapid prototyping. These anodized, deburred and polished pieces are strong and safe to work with. Note: Our new colors are now in stock !",
    "productUrl": "https://www.studica.com/288mm-l-beam-2-pack-2",
    "imageUrl": "https://www.studica.com/images/thumbs/0018107_288mm-l-beam_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76114",
    "name": "240mm L-Beam (Blue)",
    "sku": "76114",
    "category": "Robot Parts",
    "description": "240mm L-Beam (Blue) · $3.29 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/240mm-l-beam-blue-2",
    "imageUrl": "https://www.studica.com/images/thumbs/0017780_240mm-l-beam-blue_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76114-bk",
    "name": "240mm L-Beam (Black)",
    "sku": "76114-bk",
    "category": "Robot Parts",
    "description": "240mm L-Beam (Black) · $6.39 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/240mm-l-beam-black",
    "imageUrl": "https://www.studica.com/images/thumbs/0016982_240mm-l-beam-black_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76114-cl",
    "name": "240mm L-Beam (Silver)",
    "sku": "76114-cl",
    "category": "Robot Parts",
    "description": "240mm L-Beam (Silver) · $6.39 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/240mm-l-beam-clear",
    "imageUrl": "https://www.studica.com/images/thumbs/0016978_240mm-l-beam-silver_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76114-gd",
    "name": "240mm L-Beam (Gold)",
    "sku": "76114-gd",
    "category": "Robot Parts",
    "description": "240mm L-Beam (Gold) · $6.39 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/240mm-l-beam-gold",
    "imageUrl": "https://www.studica.com/images/thumbs/0016979_240mm-l-beam-gold_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76114-gn",
    "name": "240mm L-Beam (Green)",
    "sku": "76114-gn",
    "category": "Robot Parts",
    "description": "240mm L-Beam (Green) · $6.39 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/240mm-l-beam-green",
    "imageUrl": "https://www.studica.com/images/thumbs/0016980_240mm-l-beam-green_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76114-rd",
    "name": "240mm L-Beam (Red)",
    "sku": "76114-rd",
    "category": "Robot Parts",
    "description": "240mm L-Beam (Red) · $6.39 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/240mm-l-beam-red",
    "imageUrl": "https://www.studica.com/images/thumbs/0016981_240mm-l-beam-red_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76114gp",
    "name": "240mm L-Beam",
    "sku": "76114GP",
    "category": "Robot Parts",
    "description": "240mm L-Beam · price not listed · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 240mm L-Beam, in six different colors, has a width and height of 14mm each. It is strong while light-weight. It can be easily cut to your own custom size. The hole pattern matches the hole patterns in the Studica U-Channel, Low Profile U-Channel, and the various plates. Ideal for rapid prototyping. These anodized, deburred and polished pieces are strong and safe to work with. Note: Our new colors are now in stock !",
    "productUrl": "https://www.studica.com/240mm-l-beam-2-pack-2",
    "imageUrl": "https://www.studica.com/images/thumbs/0018106_240mm-l-beam_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76115",
    "name": "192mm L-Beam (Blue)",
    "sku": "76115",
    "category": "Robot Parts",
    "description": "192mm L-Beam (Blue) · $2.69 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/192mm-l-beam-blue-2",
    "imageUrl": "https://www.studica.com/images/thumbs/0017781_192mm-l-beam-blue_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76115-bk",
    "name": "192mm L-Beam (Black)",
    "sku": "76115-bk",
    "category": "Robot Parts",
    "description": "192mm L-Beam (Black) · $2.69 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/192mm-l-beam-black",
    "imageUrl": "https://www.studica.com/images/thumbs/0016968_192mm-l-beam-black_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76115-cl",
    "name": "192mm L-Beam (Silver)",
    "sku": "76115-cl",
    "category": "Robot Parts",
    "description": "192mm L-Beam (Silver) · $2.69 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/192mm-l-beam-clear",
    "imageUrl": "https://www.studica.com/images/thumbs/0016964_192mm-l-beam-silver_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76115-gd",
    "name": "192mm L-Beam (Gold)",
    "sku": "76115-gd",
    "category": "Robot Parts",
    "description": "192mm L-Beam (Gold) · $2.69 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/192mm-l-beam-gold",
    "imageUrl": "https://www.studica.com/images/thumbs/0016965_192mm-l-beam-gold_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76115-gn",
    "name": "192mm L-Beam (Green)",
    "sku": "76115-gn",
    "category": "Robot Parts",
    "description": "192mm L-Beam (Green) · $2.69 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/192mm-l-beam-green",
    "imageUrl": "https://www.studica.com/images/thumbs/0016966_192mm-l-beam-green_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76115-rd",
    "name": "192mm L-Beam (Red)",
    "sku": "76115-rd",
    "category": "Robot Parts",
    "description": "192mm L-Beam (Red) · $2.69 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/192mm-l-beam-red",
    "imageUrl": "https://www.studica.com/images/thumbs/0016967_192mm-l-beam-red_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76115gp",
    "name": "192mm L-Beam",
    "sku": "76115GP",
    "category": "Robot Parts",
    "description": "192mm L-Beam · price not listed · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 192 mm L-Beam, available in six colors, has a width and height of 14mm each. It is strong while light-weight. It can be easily cut to your own custom size. The hole pattern matches the hole patterns in the Studica U-Channel, Low Profile U-Channel, and the various plates. Ideal for rapid prototyping. These anodized, deburred and polished pieces are strong and safe to work with. Note: Our new colors are now in stock !",
    "productUrl": "https://www.studica.com/192mm-l-beam-2-pack-2",
    "imageUrl": "https://www.studica.com/images/thumbs/0018105_192mm-l-beam_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76116",
    "name": "144mm L-Beam (Blue)",
    "sku": "76116",
    "category": "Robot Parts",
    "description": "144mm L-Beam (Blue) · $2.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/144mm-l-beam-blue-2",
    "imageUrl": "https://www.studica.com/images/thumbs/0017782_144mm-l-beam-blue_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76116-bk",
    "name": "144mm L-Beam (Black)",
    "sku": "76116-bk",
    "category": "Robot Parts",
    "description": "144mm L-Beam (Black) · $2.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/144mm-l-beam-black",
    "imageUrl": "https://www.studica.com/images/thumbs/0016956_144mm-l-beam-black_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76116-cl",
    "name": "144mm L-Beam (Silver)",
    "sku": "76116-cl",
    "category": "Robot Parts",
    "description": "144mm L-Beam (Silver) · $2.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/144mm-l-beam-clear",
    "imageUrl": "https://www.studica.com/images/thumbs/0016952_144mm-l-beam-silver_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76116-gd",
    "name": "144mm L-Beam (Gold)",
    "sku": "76116-gd",
    "category": "Robot Parts",
    "description": "144mm L-Beam (Gold) · $2.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/144mm-l-beam-gold",
    "imageUrl": "https://www.studica.com/images/thumbs/0016953_144mm-l-beam-gold_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76116-gn",
    "name": "144mm L-Beam (Green)",
    "sku": "76116-gn",
    "category": "Robot Parts",
    "description": "144mm L-Beam (Green) · $2.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/144mm-l-beam-green",
    "imageUrl": "https://www.studica.com/images/thumbs/0016954_144mm-l-beam-green_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76116-rd",
    "name": "144mm L-Beam (Red)",
    "sku": "76116-rd",
    "category": "Robot Parts",
    "description": "144mm L-Beam (Red) · $2.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/144mm-l-beam-red",
    "imageUrl": "https://www.studica.com/images/thumbs/0016955_144mm-l-beam-red_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76116gp",
    "name": "144mm L-Beam",
    "sku": "76116GP",
    "category": "Robot Parts",
    "description": "144mm L-Beam · price not listed · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 144mm L-Beam has a width and height of 14mm each and is part of our colored structure collection . It is strong while lightweight. It can be easily cut to your own custom size. The hole pattern matches the hole patterns in the Studica U-Channel, Low Profile U-Channel, and the various plates. Ideal for rapid prototyping. These anodized, deburred and polished pieces are strong and safe to work with. Note: Our new color structure components (red, green, blue, silver, gold, and ",
    "productUrl": "https://www.studica.com/144mm-l-beam-2-pack-2",
    "imageUrl": "https://www.studica.com/images/thumbs/0018102_144mm-l-beam_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76117",
    "name": "96mm L-Beam (Blue)",
    "sku": "76117",
    "category": "Robot Parts",
    "description": "96mm L-Beam (Blue) · $1.89 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/96mm-l-beam-blue-2",
    "imageUrl": "https://www.studica.com/images/thumbs/0017783_96mm-l-beam-blue_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76117-bk",
    "name": "96mm L-Beam (Black)",
    "sku": "76117-bk",
    "category": "Robot Parts",
    "description": "96mm L-Beam (Black) · $1.89 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/96mm-l-beam-black",
    "imageUrl": "https://www.studica.com/images/thumbs/0017054_96mm-l-beam-black_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76117-cl",
    "name": "96mm L-Beam (Silver)",
    "sku": "76117-cl",
    "category": "Robot Parts",
    "description": "96mm L-Beam (Silver) · $1.89 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/96mm-l-beam-clear",
    "imageUrl": "https://www.studica.com/images/thumbs/0017050_96mm-l-beam-silver_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76117-gd",
    "name": "96mm L-Beam (Gold)",
    "sku": "76117-gd",
    "category": "Robot Parts",
    "description": "96mm L-Beam (Gold) · $1.89 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/96mm-l-beam-gold",
    "imageUrl": "https://www.studica.com/images/thumbs/0017051_96mm-l-beam-gold_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76117-gn",
    "name": "96mm L-Beam (Green)",
    "sku": "76117-gn",
    "category": "Robot Parts",
    "description": "96mm L-Beam (Green) · $1.89 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/96mm-l-beam-green",
    "imageUrl": "https://www.studica.com/images/thumbs/0017052_96mm-l-beam-green_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76117-rd",
    "name": "96mm L-Beam (Red)",
    "sku": "76117-rd",
    "category": "Robot Parts",
    "description": "96mm L-Beam (Red) · $1.89 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/96mm-l-beam-red",
    "imageUrl": "https://www.studica.com/images/thumbs/0017053_96mm-l-beam-red_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76117gp",
    "name": "96mm L-Beam",
    "sku": "76117GP",
    "category": "Robot Parts",
    "description": "96mm L-Beam · price not listed · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 96mm L-Beam, available in six different colors, has a width and height of 14mm each. It is strong whilelight weight. It can be easily cut to your own custom size. The hole pattern matches the hole patterns in the Studica U-Channel, Low Profile U-Channel, and the various plates. Ideal for rapid prototyping. These anodized, deburred and polished pieces are strong and safe to work with. Note: Our new colors are now in stock !",
    "productUrl": "https://www.studica.com/96mm-l-beam-2-pack-2",
    "imageUrl": "https://www.studica.com/images/thumbs/0018104_96mm-l-beam_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76118",
    "name": "48mm L-Beam (Blue)",
    "sku": "76118",
    "category": "Robot Parts",
    "description": "48mm L-Beam (Blue) · $1.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/48mm-l-beam-blue-2",
    "imageUrl": "https://www.studica.com/images/thumbs/0017784_48mm-l-beam-blue_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76118-bk",
    "name": "48mm L-Beam (Black)",
    "sku": "76118-bk",
    "category": "Robot Parts",
    "description": "48mm L-Beam (Black) · $1.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/48mm-l-beam-black",
    "imageUrl": "https://www.studica.com/images/thumbs/0017042_48mm-l-beam-black_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76118-cl",
    "name": "48mm L-Beam (Silver)",
    "sku": "76118-cl",
    "category": "Robot Parts",
    "description": "48mm L-Beam (Silver) · $1.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/48mm-l-beam-clear",
    "imageUrl": "https://www.studica.com/images/thumbs/0017038_48mm-l-beam-silver_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76118-gd",
    "name": "48mm L-Beam (Gold)",
    "sku": "76118-gd",
    "category": "Robot Parts",
    "description": "48mm L-Beam (Gold) · $1.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/48mm-l-beam-gold",
    "imageUrl": "https://www.studica.com/images/thumbs/0017039_48mm-l-beam-gold_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76118-gn",
    "name": "48mm L-Beam (Green)",
    "sku": "76118-gn",
    "category": "Robot Parts",
    "description": "48mm L-Beam (Green) · $1.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/48mm-l-beam-green",
    "imageUrl": "https://www.studica.com/images/thumbs/0017040_48mm-l-beam-green_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76118-rd",
    "name": "48mm L-Beam (Red)",
    "sku": "76118-rd",
    "category": "Robot Parts",
    "description": "48mm L-Beam (Red) · $1.49 · Studica Robot Parts listing (collected Oct 2026)",
    "productUrl": "https://www.studica.com/48mm-l-beam-red",
    "imageUrl": "https://www.studica.com/images/thumbs/0017041_48mm-l-beam-red_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76118gp",
    "name": "48mm L-Beam",
    "sku": "76118GP",
    "category": "Robot Parts",
    "description": "48mm L-Beam · price not listed · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 48mm L-Beam, available in six different colors, has a width and height of 14mm each. It is strong while light-weight. It can be easily cut to your own custom size. The hole pattern matches the hole patterns in the Studica U-Channel, Low Profile U-Channel, and the various plates. Ideal for rapid prototyping. These anodized, deburred and polished pieces are strong and safe to work with. Note: Our new colors are now in stock !",
    "productUrl": "https://www.studica.com/48mm-l-beam-2-pack-2",
    "imageUrl": "https://www.studica.com/images/thumbs/0018103_48mm-l-beam_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76130",
    "name": "M3 T-Slot Nut (100 pack)",
    "sku": "76130",
    "category": "Robot Parts",
    "description": "M3 T-Slot Nut (100 pack) · $4.39 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics M3 T-Slot Nut 100 pack, is a Hammer Head Series 20, used with any M3 screw and fits the Studica T-Slot Extrusion.",
    "productUrl": "https://www.studica.com/m3-t-slot-nut-100-pack",
    "imageUrl": "https://www.studica.com/images/thumbs/0006654_m3-t-slot-nut-100-pack_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76138",
    "name": "Orbital Motor Mount",
    "sku": "76138",
    "category": "Robot Parts",
    "description": "Orbital Motor Mount · $6.99 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics Orbital Motor Mount is used to fasten an orbital motor to your model's U-channel.",
    "productUrl": "https://www.studica.com/orbital-motor-mount",
    "imageUrl": "https://www.studica.com/images/thumbs/0014820_orbital-motor-mount_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76139",
    "name": "Motor Mount Plate Leaf",
    "sku": "76139",
    "category": "Robot Parts",
    "description": "Motor Mount Plate Leaf · $5.99 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics Motor Mount Plate Leaf is used with the Maverick 12V DC Gear Motor to attach to the inside any U-Channels.",
    "productUrl": "https://www.studica.com/motor-mount-plate-leaf",
    "imageUrl": "https://www.studica.com/images/thumbs/0004152_motor-mount-plate-leaf_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76140",
    "name": "Motor Mount Plate",
    "sku": "76140",
    "category": "Robot Parts",
    "description": "Motor Mount Plate · $6.99 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics Motor Mount Plate is used with the Maverick 12V DC Gear Motor to attach to the inside any U-Channels.",
    "productUrl": "https://www.studica.com/motor-mount-plate",
    "imageUrl": "https://www.studica.com/images/thumbs/0003231_motor-mount-plate_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76141",
    "name": "Motor Mount Clamp Kit",
    "sku": "76141",
    "category": "Robot Parts",
    "description": "Motor Mount Clamp Kit · $12.99 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics Motor Mount Clamp kit is used for fastening motors on the body of your robot and attaching the kit to a channel and/or other structures.",
    "productUrl": "https://www.studica.com/motor-mount-clamp-kit",
    "imageUrl": "https://www.studica.com/images/thumbs/0003232_motor-mount-clamp-kit_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76143-2",
    "name": "End Piece Plate (2 pack)",
    "sku": "76143-2",
    "category": "Robot Parts",
    "description": "End Piece Plate (2 pack) · $12.99 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics End Piece Plate (2 pack) is commonly fastened to the inside end of the U Channel. As with the other Studica Robotics building components, it has the common hole pattern which makes it easy to connect to other structure with very little or no additional machining required.",
    "productUrl": "https://www.studica.com/end-piece-plate-2-pack",
    "imageUrl": "https://www.studica.com/images/thumbs/0018112_end-piece-plate-2-pack_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76145",
    "name": "Servo Mount Flat Plate",
    "sku": "76145",
    "category": "Robot Parts",
    "description": "Servo Mount Flat Plate · $7.59 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics Servo Mount Flat Plate is designed to mount the Multi-Mode Smart Servo (part #75002) to the Studica building structure.",
    "productUrl": "https://www.studica.com/servo-mount-flat-plate",
    "imageUrl": "https://www.studica.com/images/thumbs/0002887_servo-mount-flat-plate_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76146",
    "name": "Servo Mount Offset Plate",
    "sku": "76146",
    "category": "Robot Parts",
    "description": "Servo Mount Offset Plate · $7.99 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics Servo Mount Offset Plate is used to mount the Multi-Mode Smart Servo (part #75002) to the Studica building structure.",
    "productUrl": "https://www.studica.com/servo-mount-offset-plate",
    "imageUrl": "https://www.studica.com/images/thumbs/0002886_servo-mount-offset-plate_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76149",
    "name": "6mm D-Shaft Servo Hub 25T",
    "sku": "76149",
    "category": "Robot Parts",
    "description": "6mm D-Shaft Servo Hub 25T · $6.49 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 6mm D-Shaft Servo Hub 25T is made of anodized 6061-T6 Aluminum and is used to connect a servo motor to a D-Shaft axle.",
    "productUrl": "https://www.studica.com/6mm-servo-hub-25t",
    "imageUrl": "https://www.studica.com/images/thumbs/0009612_6mm-d-shaft-servo-hub-25t_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76150",
    "name": "Servo Arm Extended",
    "sku": "76150",
    "category": "Robot Parts",
    "description": "Servo Arm Extended · $6.59 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics Servo Arm Extended can be used with the Multi Mode Servo, Multi Mode Servo 200, or most servos with a 25 Tooth gear.",
    "productUrl": "https://www.studica.com/servo-arm-extended",
    "imageUrl": "https://www.studica.com/images/thumbs/0014221_servo-arm-extended_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76151",
    "name": "Servo Arm",
    "sku": "76151",
    "category": "Robot Parts",
    "description": "Servo Arm · $6.49 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics RC Servo Arm can be used with the Multi Mode Smart Servo , Multi Mode Smart Servo 200 , or most servos with a 25 Tooth gear.",
    "productUrl": "https://www.studica.com/servo-arm",
    "imageUrl": "https://www.studica.com/images/thumbs/0014210_servo-arm_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76152",
    "name": "Servo Hub Pro",
    "sku": "76152",
    "category": "Robot Parts",
    "description": "Servo Hub Pro · $6.49 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics Servo Hub Pro can be used with the Multi Mode Servo, Multi Mode Servo 200, and most servos with a 25 Tooth gear.",
    "productUrl": "https://www.studica.com/servo-hub-pro",
    "imageUrl": "https://www.studica.com/images/thumbs/0014212_servo-hub-pro_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76153",
    "name": "Servo Spline Gear - 30T Gear, 25T Spline",
    "sku": "76153",
    "category": "Robot Parts",
    "description": "Servo Spline Gear - 30T Gear, 25T Spline · $10.99 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics Servo Spline Gear is a 30-Tooth Gear with a 25-Tooth Spline. It is used with the Multi-Mode Smart Servo or Multi-Mode Smart Servo 200.",
    "productUrl": "https://www.studica.com/30t-servo-25t-spline-gear",
    "imageUrl": "https://www.studica.com/images/thumbs/0014727_servo-spline-gear-30t-gear-25t-spline_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76200-100",
    "name": "M3 x 8mm Socket Head Cap Screw (100 pack)",
    "sku": "76200-100",
    "category": "Robot Parts",
    "description": "M3 x 8mm Socket Head Cap Screw (100 pack) · $13.99 · Studica Robot Parts listing (collected Oct 2026) · A zinc-plated, M3 x 8mm Socket Head Cap Screw (pack of 100). Can be used with our M3 Stainless Steel Split Washers for an ideal fit.",
    "productUrl": "https://www.studica.com/m3-8mm-socketad-cap-screw-100-pack",
    "imageUrl": "https://www.studica.com/images/thumbs/0003358_m3-x-8mm-socket-head-cap-screw-100-pack_200.png"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76201-100",
    "name": "M3 x 10mm Socket Head Cap Screw (100 pack)",
    "sku": "76201-100",
    "category": "Robot Parts",
    "description": "M3 x 10mm Socket Head Cap Screw (100 pack) · $14.59 · Studica Robot Parts listing (collected Oct 2026) · A zinc-plated, M3 x 10mm Socket Head Cap Screw (pack of 100). Can be used with our M3 Stainless Steel Split Washers for an ideal fit.",
    "productUrl": "https://www.studica.com/m3-10mm-socketad-cap-screw-100-pack",
    "imageUrl": "https://www.studica.com/images/thumbs/0003360_m3-x-10mm-socket-head-cap-screw-100-pack_200.png"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76202-100",
    "name": "M3 x 12mm Socket Head Cap Screw (100 pack)",
    "sku": "76202-100",
    "category": "Robot Parts",
    "description": "M3 x 12mm Socket Head Cap Screw (100 pack) · $15.59 · Studica Robot Parts listing (collected Oct 2026) · A zinc-plated, M3 x 12mm Socket Head Cap Screw (pack of 100). Can be used with our M3 Stainless Steel Split Washers for an ideal fit.",
    "productUrl": "https://www.studica.com/m3-12mm-socket-head-cap-screw-100-pack",
    "imageUrl": "https://www.studica.com/images/thumbs/0003359_m3-x-12mm-socket-head-cap-screw-100-pack_200.png"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76203-50",
    "name": "M3 x 10mm Button Head Cap Screw (50 pack)",
    "sku": "76203-50",
    "category": "Robot Parts",
    "description": "M3 x 10mm Button Head Cap Screw (50 pack) · $9.89 · Studica Robot Parts listing (collected Oct 2026) · A zinc-plated, M3 x 10mm Button Head Cap Screw (pack of 50). Can be used with our M3 Stainless Steel Split Washers for an ideal fit.",
    "productUrl": "https://www.studica.com/m3-10mm-buttonad-cap-screw-50-pack",
    "imageUrl": "https://www.studica.com/images/thumbs/0003364_m3-x-10mm-button-head-cap-screw-50-pack_200.png"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76204-100",
    "name": "M3 Kep Nut (pack of 100)",
    "sku": "76204-100",
    "category": "Robot Parts",
    "description": "M3 Kep Nut (pack of 100) · $10.89 · Studica Robot Parts listing (collected Oct 2026) · A pack of 100 Studica Robotics M3 Kep Nuts for use with robotics design.",
    "productUrl": "https://www.studica.com/m3-kep-nut-pack-of-100",
    "imageUrl": "https://www.studica.com/images/thumbs/0003363_m3-kep-nut-pack-of-100_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76205-100",
    "name": "M3 Nyloc Nut (pack of 100)",
    "sku": "76205-100",
    "category": "Robot Parts",
    "description": "M3 Nyloc Nut (pack of 100) · $9.99 · Studica Robot Parts listing (collected Oct 2026) · A pack of 100 Studica Robotics M3 Nyloc Nuts for robotics design.",
    "productUrl": "https://www.studica.com/nyloc-nuts-m3-pack-of-100",
    "imageUrl": "https://www.studica.com/images/thumbs/0003362_m3-nyloc-nut-pack-of-100_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76206-50",
    "name": "M3 x 30mm Socket Head Cap Screw (50 pack)",
    "sku": "76206-50",
    "category": "Robot Parts",
    "description": "M3 x 30mm Socket Head Cap Screw (50 pack) · $8.99 · Studica Robot Parts listing (collected Oct 2026) · A zinc-plated, M3 x 30mm Socket Head Cap Screw (pack of 50). Can be used with our M3 Stainless Steel Split Washers for an ideal fit.",
    "productUrl": "https://www.studica.com/m3-30mm-socketad-cap-screw-50-pack",
    "imageUrl": "https://www.studica.com/images/thumbs/0003361_m3-x-30mm-socket-head-cap-screw-50-pack_200.png"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76209-50",
    "name": "M3 x 20mm Socket Head Cap Screw (50 pack)",
    "sku": "76209-50",
    "category": "Robot Parts",
    "description": "M3 x 20mm Socket Head Cap Screw (50 pack) · $8.59 · Studica Robot Parts listing (collected Oct 2026) · A zinc-plated, M3 x 20mm Socket Head Cap Screw (pack of 50). Can be used with our M3 Stainless Steel Split Washers for an ideal fit.",
    "productUrl": "https://www.studica.com/m3-20mm-socketad-cap-screw-50-pack",
    "imageUrl": "https://www.studica.com/images/thumbs/0003357_m3-x-20mm-socket-head-cap-screw-50-pack_200.png"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76219-2",
    "name": "30 Tooth Bevel Gear, 1-to-1 Set (2 pack)",
    "sku": "76219-2",
    "category": "Robot Parts",
    "description": "30 Tooth Bevel Gear, 1-to-1 Set (2 pack) · $29.99 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 30-tooth bevel gear, 1-1 set (2 pack) is ideal for robotics design builds.",
    "productUrl": "https://www.studica.com/30-tooth-bevel-gear-1-to-1-set-2-pack",
    "imageUrl": "https://www.studica.com/images/thumbs/0009634_30-tooth-bevel-gear-1-to-1-set-2-pack_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76220-2",
    "name": "32 Tooth Gear (2 pack)",
    "sku": "76220-2",
    "category": "Robot Parts",
    "description": "32 Tooth Gear (2 pack) · $14.29 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 32-tooth gear (2-pack) is ideal for use with robotics design builds.",
    "productUrl": "https://www.studica.com/32-tooth-gear-2-pack",
    "imageUrl": "https://www.studica.com/images/thumbs/0009635_32-tooth-gear-2-pack_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76221-2",
    "name": "64 Tooth Gear (2 pack)",
    "sku": "76221-2",
    "category": "Robot Parts",
    "description": "64 Tooth Gear (2 pack) · $29.99 · Studica Robot Parts listing (collected Oct 2026) · A Studica Robotics 64-tooth gear (2 pack), for use with robotics design builds.",
    "productUrl": "https://www.studica.com/64-tooth-gear-2-pack",
    "imageUrl": "https://www.studica.com/images/thumbs/0009651_64-tooth-gear-2-pack_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76222",
    "name": "128 Tooth Gear",
    "sku": "76222",
    "category": "Robot Parts",
    "description": "128 Tooth Gear · $24.99 · Studica Robot Parts listing (collected Oct 2026) · A 128 tooth gear for robotics design, made from 6061-T6 aluminum, with a 6.35mm thickness and a 14mm hole diameter.",
    "productUrl": "https://www.studica.com/128-tooth-gear",
    "imageUrl": "https://www.studica.com/images/thumbs/0009685_128-tooth-gear_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76224-2",
    "name": "26 Tooth Bevel Gear (2 pack)",
    "sku": "76224-2",
    "category": "Robot Parts",
    "description": "26 Tooth Bevel Gear (2 pack) · $14.99 · Studica Robot Parts listing (collected Oct 2026) · A Studica Robotics 26-tooth bevel gear for use in robotics design and competitions.",
    "productUrl": "https://www.studica.com/26-tooth-bevel-gear-2-pack",
    "imageUrl": "https://www.studica.com/images/thumbs/0009686_26-tooth-bevel-gear-2-pack_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76226-2",
    "name": "#25 - 24 Tooth Aluminum Sprocket (2 pack)",
    "sku": "76226-2",
    "category": "Robot Parts",
    "description": "#25 - 24 Tooth Aluminum Sprocket (2 pack) · $12.99 · Studica Robot Parts listing (collected Oct 2026) · A Studica Robotics 2-pack of #25 - 24 tooth sprockets for use with robotics design, made of 6061-T6 aluminum.",
    "productUrl": "https://www.studica.com/no-25-24-tooth-sprocket-2-pack",
    "imageUrl": "https://www.studica.com/images/thumbs/0004138_25-24-tooth-aluminum-sprocket-2-pack_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76228",
    "name": "#25 - 40 Tooth Sprocket",
    "sku": "76228",
    "category": "Robot Parts",
    "description": "#25 - 40 Tooth Sprocket · $12.99 · Studica Robot Parts listing (collected Oct 2026) · A Studica Robotics #25 - 40 tooth sprocket for use with robotics design, made of 6061-T6 aluminum.",
    "productUrl": "https://www.studica.com/no-25-40-tooth-sprocket",
    "imageUrl": "https://www.studica.com/images/thumbs/0004512_25-40-tooth-sprocket_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76230",
    "name": "#25 Chain with Master Links (5 feet)",
    "sku": "76230",
    "category": "Robot Parts",
    "description": "#25 Chain with Master Links (5 feet) · $16.49 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics #25 Chain with Master Links set, works with any of the Studica sprockets and other #25 sprockets. It includes 4 master links for creating various lengths of the chain.",
    "productUrl": "https://www.studica.com/no-25-chain-with-master-links-5-feet",
    "imageUrl": "https://www.studica.com/images/thumbs/0009717_25-chain-with-master-links-5-feet_200.png"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76232-2",
    "name": "6mm XL Pulley, 10 Tooth (2 pack)",
    "sku": "76232-2",
    "category": "Robot Parts",
    "description": "6mm XL Pulley, 10 Tooth (2 pack) · $12.99 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 6mm, 10-tooth XL Pulley (2 pack) is ideal for use with the Maverick DC Motor with a 6mm shaft and all 6mm D-Shaft Axles.",
    "productUrl": "https://www.studica.com/6mm-xl-pulley-10-tooth-2-pack",
    "imageUrl": "https://www.studica.com/images/thumbs/0009621_6mm-xl-pulley-10-tooth-2-pack_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76234",
    "name": "10mm OD Round Groove D-shaft Pulley",
    "sku": "76234",
    "category": "Robot Parts",
    "description": "10mm OD Round Groove D-shaft Pulley · $4.59 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 10mm OD round groove D-shaft pulley is for use with your robot design builds.",
    "productUrl": "https://www.studica.com/10mm-od-round-groove-pulley",
    "imageUrl": "https://www.studica.com/images/thumbs/0009615_10mm-od-round-groove-d-shaft-pulley_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76235",
    "name": "20mm OD Round Groove D-shaft Pulley",
    "sku": "76235",
    "category": "Robot Parts",
    "description": "20mm OD Round Groove D-shaft Pulley · $4.99 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 20mm OD round groove D-shaft pulley is for use in robot design builds.",
    "productUrl": "https://www.studica.com/20mm-od-round-groove-pulley",
    "imageUrl": "https://www.studica.com/images/thumbs/0004131_20mm-od-round-groove-d-shaft-pulley_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76236",
    "name": "30mm OD Round Groove D-shaft Pulley",
    "sku": "76236",
    "category": "Robot Parts",
    "description": "30mm OD Round Groove D-shaft Pulley · $5.99 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 30mm OD round groove D-shaft pulley is for use with robotics design builds.",
    "productUrl": "https://www.studica.com/30mm-od-round-groove-pulley",
    "imageUrl": "https://www.studica.com/images/thumbs/0009617_30mm-od-round-groove-d-shaft-pulley_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76237",
    "name": "40mm OD Round Groove D-shaft Pulley",
    "sku": "76237",
    "category": "Robot Parts",
    "description": "40mm OD Round Groove D-shaft Pulley · $6.99 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 40mm OD round groove D-shaft pulley is for use with your robotics design builds.",
    "productUrl": "https://www.studica.com/40mm-od-round-groove-pulley",
    "imageUrl": "https://www.studica.com/images/thumbs/0009618_40mm-od-round-groove-d-shaft-pulley_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76238",
    "name": "50mm OD Round Groove D-shaft Pulley",
    "sku": "76238",
    "category": "Robot Parts",
    "description": "50mm OD Round Groove D-shaft Pulley · $7.49 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 50mm OD round groove D-shaft pulley is for use with your robotics design builds.",
    "productUrl": "https://www.studica.com/50mm-od-round-groove-pulley",
    "imageUrl": "https://www.studica.com/images/thumbs/0009619_50mm-od-round-groove-d-shaft-pulley_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76239",
    "name": "60mm OD Round Groove D-shaft Pulley",
    "sku": "76239",
    "category": "Robot Parts",
    "description": "60mm OD Round Groove D-shaft Pulley · $12.99 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 60mm OD round groove D-shaft pulley is for use with your robotics design builds.",
    "productUrl": "https://www.studica.com/60mm-od-round-groove-pulley",
    "imageUrl": "https://www.studica.com/images/thumbs/0009620_60mm-od-round-groove-d-shaft-pulley_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76241",
    "name": "Mecanum Wheel L (Left Slant - 100mm - w/6mm Hub)",
    "sku": "76241",
    "category": "Robot Parts",
    "description": "Mecanum Wheel L (Left Slant - 100mm - w/6mm Hub) · $29.99 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics100mm left-slant Mecanum Wheel is constructed with a blue aluminum frame with yellow rollers and a 6mm Hub. The wheel is comprised of 9 rollers, able to move in any direction. The rollers are set at 45° to the axis of rotation of the wheel.",
    "productUrl": "https://www.studica.com/mecanum-wheel-l-left-slant-100mm-w-6mm-hub",
    "imageUrl": "https://www.studica.com/images/thumbs/0003285_mecanum-wheel-l-left-slant-100mm-w6mm-hub_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76242",
    "name": "Mecanum Wheel R (Right Slant - 100mm - w/6mm Hub)",
    "sku": "76242",
    "category": "Robot Parts",
    "description": "Mecanum Wheel R (Right Slant - 100mm - w/6mm Hub) · $29.99 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics100mm right-slant Mecanum Wheel is constructed with a blue aluminum frame with yellow rollers and a 6mm Hub. The wheel is comprised of 9 rollers, able to move in any direction. The rollers are set at 45° to the axis of rotation of the wheel.",
    "productUrl": "https://www.studica.com/mecanum-wheel-r-right-slant-100mm-w-6mm-hub",
    "imageUrl": "https://www.studica.com/images/thumbs/0003286_mecanum-wheel-r-right-slant-100mm-w6mm-hub_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76246",
    "name": "100mm Mecanum Wheel Set Slim Design Bearing Rollers 2 left 2 right",
    "sku": "76246",
    "category": "Robot Parts",
    "description": "100mm Mecanum Wheel Set Slim Design Bearing Rollers 2 left 2 right · $179.99 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 100mm Slim Mecanum Wheel Set comes with 2 left and 2 right wheels features a sleek slim design with steel ball bearings, blue steel frame and black rollers. The wheel comprised of 12 black rollers and is able to move in any direction. Rollers are set at 45° to the axis of rotation of the wheel. Rollers are mounted with steel ball bearings, making them roll more fluent. Click to Apply for a FIRST Team Discount",
    "productUrl": "https://www.studica.com/100mm-slim-mecanum-wheel-set-bearing-rollers-2-left-2-right",
    "imageUrl": "https://www.studica.com/images/thumbs/0015107_100mm-mecanum-wheel-set-slim-design-bearing-rollers-2-left-2-right_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76249",
    "name": "125mm All-Terrain Robotics Tire Set",
    "sku": "76249",
    "category": "Robot Parts",
    "description": "125mm All-Terrain Robotics Tire Set · $69.99 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 125mm All-Terrain Robotics Tire Set includes two left and two right rubber tires. They have a foam core and therefore do not require air.",
    "productUrl": "https://www.studica.com/125mm-all-terrain-wheel-set",
    "imageUrl": "https://www.studica.com/images/thumbs/0018435_125mm-all-terrain-robotics-tire-set_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76259",
    "name": "38mm Omni Wheel",
    "sku": "76259",
    "category": "Robot Parts",
    "description": "38mm Omni Wheel · $14.99 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 38mm Omni Wheel was designed as an odometry wheel that can fit inside most channel sizes. For ease of use, three cores were designed to fit the 6mm D-Shaft Center, 5mm Hex Shaft Center, 6mm Hex Shaft Center, and 7mm Hex Shaft Center. The wheel is open for easy use in any ecosystem with the provided different-sized cores.",
    "productUrl": "https://www.studica.com/38mm-omni-wheel",
    "imageUrl": "https://www.studica.com/images/thumbs/0019319_38mm-omni-wheel_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76261",
    "name": "100mm Drive Wheel, 50A, 12.5mm wide, 1/2\" Inner Hex, Blue",
    "sku": "76261",
    "category": "Robot Parts",
    "description": "100mm Drive Wheel, 50A, 12.5mm wide, 1/2\" Inner Hex, Blue · $9.99 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 100mm Drive Wheel (4\"), with a 12.5mm axial width can be used as a simple wheel providing good traction on carpet and tile flooring. They can also be used for intake systems. Use with 1/2\" hex shaft or use a 6mm Shaft Hub to connect to 6mm D-Shaft axles.",
    "productUrl": "https://www.studica.com/100mm-drive-wheel-50a-12-5mm-wide-1-2-inch-inner-hex-blue",
    "imageUrl": "https://www.studica.com/images/thumbs/0009688_100mm-drive-wheel-50a-125mm-wide-12-inner-hex-blue_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76262",
    "name": "100mm Drive Wheel, 50A, 25mm wide, 1/2\" Inner Hex, Blue",
    "sku": "76262",
    "category": "Robot Parts",
    "description": "100mm Drive Wheel, 50A, 25mm wide, 1/2\" Inner Hex, Blue · $10.99 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 100mm Drive Wheel (4\") with an axial width of 25mm, can be used as a simple wheel providing good traction on carpet and tile flooring. They can also be used for intake systems. Use with 1/2\" Hex Shaft or 6mm Shaft Hub to use connect 6mm D-Shaft Axles.",
    "productUrl": "https://www.studica.com/100mm-drive-wheel-50a-25mm-wide-1-2-inch-inner-hex-blue",
    "imageUrl": "https://www.studica.com/images/thumbs/0009689_100mm-drive-wheel-50a-25mm-wide-12-inner-hex-blue_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76263",
    "name": "100mm Flex Wheel, 35A, 25mm wide, 1/2\" Inner Hex, Green",
    "sku": "76263",
    "category": "Robot Parts",
    "description": "100mm Flex Wheel, 35A, 25mm wide, 1/2\" Inner Hex, Green · $7.99 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 100mm Flex Wheel (4\"), with a 25mm axial width can be used for intake systems and conveyors with your robotics design builds.",
    "productUrl": "https://www.studica.com/100mm-flewheel-35a-25mm-wide-1-2-inch-inner-hex-green",
    "imageUrl": "https://www.studica.com/images/thumbs/0009690_100mm-flex-wheel-35a-25mm-wide-12-inner-hex-green_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76264",
    "name": "100mm Flex Wheel, 40A, 25mm wide, 1/2\" Inner Hex, Orange",
    "sku": "76264",
    "category": "Robot Parts",
    "description": "100mm Flex Wheel, 40A, 25mm wide, 1/2\" Inner Hex, Orange · $7.99 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 100mm (4\") orange Flex Wheel with an axial width of 25mm and a durometer of 40A can be used for intake systems and conveyors.",
    "productUrl": "https://www.studica.com/100mm-flewheel-40a-25mm-wide-1-2-inch-inner-hex-orange",
    "imageUrl": "https://www.studica.com/images/thumbs/0009691_100mm-flex-wheel-40a-25mm-wide-12-inner-hex-orange_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76265",
    "name": "100mm Flex Wheel, 50A, 25mm wide, 1/2\" Inner Hex, Blue",
    "sku": "76265",
    "category": "Robot Parts",
    "description": "100mm Flex Wheel, 50A, 25mm wide, 1/2\" Inner Hex, Blue · $7.99 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 100mm (4\") blue Flex Wheel with an axial width of 25mm and a durometer of 50A can be used for intake systems and conveyors.",
    "productUrl": "https://www.studica.com/100mm-flewheel-50a-25mm-wide-1-2-inch-inner-hex-blue",
    "imageUrl": "https://www.studica.com/images/thumbs/0009692_100mm-flex-wheel-50a-25mm-wide-12-inner-hex-blue_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76266",
    "name": "100mm Flex Wheel, 60A, 25mm wide, 1/2\" Inner Hex, Black",
    "sku": "76266",
    "category": "Robot Parts",
    "description": "100mm Flex Wheel, 60A, 25mm wide, 1/2\" Inner Hex, Black · $7.99 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 100mm (4\") black Flex Wheel with an axial width of 25mm and a durometer of 60A can be used for intake systems and conveyors.",
    "productUrl": "https://www.studica.com/100mm-flewheel-60a-25mm-wide-1-2-inch-inner-hex-black",
    "imageUrl": "https://www.studica.com/images/thumbs/0009693_100mm-flex-wheel-60a-25mm-wide-12-inner-hex-black_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76267",
    "name": "50mm Drive Wheel, 35A, 25mm wide, 1/2\" Inner Hex, Green",
    "sku": "76267",
    "category": "Robot Parts",
    "description": "50mm Drive Wheel, 35A, 25mm wide, 1/2\" Inner Hex, Green · $6.99 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 50mm (2\") green Drive Wheel with a durometer of 35A can be used as a simple wheel providing good traction on carpet and tile flooring. The drive wheel can also be used for intake systems and with 1/2\" hex shafts or 6mm Shaft Hubs to connect 6mm D-Shaft Axles.",
    "productUrl": "https://www.studica.com/50mm-drive-wheel-35a-25mm-wide-1-2-inch-inner-hex-green",
    "imageUrl": "https://www.studica.com/images/thumbs/0009698_50mm-drive-wheel-35a-25mm-wide-12-inner-hex-green_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76268",
    "name": "50mm Drive Wheel, 40A, 25mm wide, 1/2\" Inner Hex, Orange",
    "sku": "76268",
    "category": "Robot Parts",
    "description": "50mm Drive Wheel, 40A, 25mm wide, 1/2\" Inner Hex, Orange · $6.99 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 50mm (2\") orange Drive Wheel with a durometer of 40A can be used as a simple wheel providing good traction on carpet and tile flooring. The drive wheel can also be used for intake systems and with 1/2\" hex shafts or 6mm Shaft Hubs to connect 6mm D-Shaft Axles.",
    "productUrl": "https://www.studica.com/50mm-drive-wheel-40a-25mm-wide-1-2-inch-inner-hex-orange",
    "imageUrl": "https://www.studica.com/images/thumbs/0009699_50mm-drive-wheel-40a-25mm-wide-12-inner-hex-orange_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76269",
    "name": "50mm Drive Wheel, 50A, 25mm wide, 1/2\" Inner Hex, Blue",
    "sku": "76269",
    "category": "Robot Parts",
    "description": "50mm Drive Wheel, 50A, 25mm wide, 1/2\" Inner Hex, Blue · $6.99 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 50mm (2\") blue Drive Wheel with a durometer of 50A can be used as a simple wheel providing good traction on carpet and tile flooring. They can also be used for intake systems.",
    "productUrl": "https://www.studica.com/50mm-drive-wheel-50a-25mm-wide-1-2-inch-inner-hex-blue",
    "imageUrl": "https://www.studica.com/images/thumbs/0009700_50mm-drive-wheel-50a-25mm-wide-12-inner-hex-blue_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76270",
    "name": "50mm Drive Wheel, 60A, 25mm wide, 1/2\" Inner Hex, Black",
    "sku": "76270",
    "category": "Robot Parts",
    "description": "50mm Drive Wheel, 60A, 25mm wide, 1/2\" Inner Hex, Black · $6.99 · Studica Robot Parts listing (collected Oct 2026) · The 50mm (2\") Studica Robotics black Drive Wheel with a durometer of 60A can be used as a simple wheel providing good traction on carpet and tile flooring. They can also be used for intake systems. For use with the 1/2\" hex shaft or 6mm Shaft Hub to connect to 6mm D-Shaft Axles.",
    "productUrl": "https://www.studica.com/50mm-drive-wheel-60a-25mm-wide-1-2-inch-inner-hex-black",
    "imageUrl": "https://www.studica.com/images/thumbs/0009701_50mm-drive-wheel-60a-25mm-wide-12-inner-hex-black_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76272",
    "name": "100mm Omni Wheel",
    "sku": "76272",
    "category": "Robot Parts",
    "description": "100mm Omni Wheel · $29.99 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 100mm (4 inch) Omni Wheel provides rotational and sideways 360° maneuverability. Great for omni directional movement and rotation, easy direction control and tracking, and for fast turning. Use the Enhanced Wheel D-Shaft Hub Kit with this Omni Wheel.",
    "productUrl": "https://www.studica.com/100mm-omni-wheel",
    "imageUrl": "https://www.studica.com/images/thumbs/0019204_100mm-omni-wheel_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76281",
    "name": "Clamping 6mm D-Shaft Hub",
    "sku": "76281",
    "category": "Robot Parts",
    "description": "Clamping 6mm D-Shaft Hub · $7.99 · Studica Robot Parts listing (collected Oct 2026) · Made of aluminum, the Studica Robotics Clamping 6mm D-Shaft Hub is used with flex and drive wheels .",
    "productUrl": "https://www.studica.com/clamping-shaft-hub",
    "imageUrl": "https://www.studica.com/images/thumbs/0019203_clamping-6mm-d-shaft-hub_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76282-2",
    "name": "Light Weight 6mm D-Shaft Hub - 2 Pack",
    "sku": "76282-2",
    "category": "Robot Parts",
    "description": "Light Weight 6mm D-Shaft Hub - 2 Pack · $7.99 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics Light Weight 6mm D-Shaft Hub (2 pack) are used with 6mm D shafts . They have a 5mm set screw for tight clamping and seven M3 tapped mounting holes.",
    "productUrl": "https://www.studica.com/light-weight-shaft-hub",
    "imageUrl": "https://www.studica.com/images/thumbs/0014750_light-weight-6mm-d-shaft-hub-2-pack_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76284-4",
    "name": "6mm D-Shaft Hub (4 pack)",
    "sku": "76284-4",
    "category": "Robot Parts",
    "description": "6mm D-Shaft Hub (4 pack) · $9.99 · Studica Robot Parts listing (collected Oct 2026) · The 6mm D-Shaft Hub from Studica Robotics is a precision aluminum mounting hub that connects a 6mm D-shaft to wheels or robot components. Ideal for a secure shaft to mounting hub connection. Sold in a pack of 4.",
    "productUrl": "https://www.studica.com/6mm-shaft-hub-4-pack",
    "imageUrl": "https://www.studica.com/images/thumbs/0009706_6mm-d-shaft-hub-4-pack_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76288",
    "name": "5mm Hex Shaft Hub Kit",
    "sku": "76288",
    "category": "Robot Parts",
    "description": "5mm Hex Shaft Hub Kit · $9.99 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 5mm Hex Shaft Hub allows users that have existing Omni Wheels (Part# 76260 ) or Mecanum Wheels (Part# 76243 ) to use REV Robotics 5mm Hex Shafts and Hex Motors.",
    "productUrl": "https://www.studica.com/5mm-hex-shaft-hub-kit",
    "imageUrl": "https://www.studica.com/images/thumbs/0009703_5mm-hex-shaft-hub-kit_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76289",
    "name": "1-1 Motor Plate 5mm Hex-Shaft Kit",
    "sku": "76289",
    "category": "Robot Parts",
    "description": "1-1 Motor Plate 5mm Hex-Shaft Kit · $9.99 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 1:1 motor mounting plate kit can be used with the Studica Maverick or any FTC legal motor such as the Neverest Classic (6600 RPM) or the REV HD Hex motor (6000RPM).",
    "productUrl": "https://www.studica.com/1-1-motor-kit-5mmshaft",
    "imageUrl": "https://www.studica.com/images/thumbs/0009694_1-1-motor-plate-5mm-hex-shaft-kit_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76290",
    "name": "1-1 Motor D-Shaft Kit",
    "sku": "76290",
    "category": "Robot Parts",
    "description": "1-1 Motor D-Shaft Kit · $9.99 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 1-1 Motor D-Shaft Kit can be used with the Studica Maverick or any FTC legal motor such as the Neverest Classic (6600 RPM) or the REV HD Hex motor (6000 RPM). The kit includes a faceplate which supports the Studica Robotics building platform. The shaft is press-fit onto the motor's shaft. It is recommended that the shaft be supported by a bearing (part # 76302 for the Studica building system).",
    "productUrl": "https://www.studica.com/1-1-motor-kit-6mm-d-shaft",
    "imageUrl": "https://www.studica.com/images/thumbs/0009695_1-1-motor-d-shaft-kit_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76291",
    "name": "Enhanced D-Shaft Wheel Hub Kit",
    "sku": "76291",
    "category": "Robot Parts",
    "description": "Enhanced D-Shaft Wheel Hub Kit · $16.49 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics enhanced D-shaft wheel hub kit is ideal for use with the Omni and Mecanum wheels for a strong axle hold.",
    "productUrl": "https://www.studica.com/enhanced-wheel-hub-kit",
    "imageUrl": "https://www.studica.com/images/thumbs/0008680_enhanced-d-shaft-wheel-hub-kit_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76293",
    "name": "6mm D-Shaft Collar Clamp (2 Piece)",
    "sku": "76293",
    "category": "Robot Parts",
    "description": "6mm D-Shaft Collar Clamp (2 Piece) · $4.39 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 6mm D-shaft collar clamp (2-piece) has a 6mm D-hole and dimensions of 20mm x 8mm.",
    "productUrl": "https://www.studica.com/6mm-d-shaft-collar-clamp-2-piece",
    "imageUrl": "https://www.studica.com/images/thumbs/0014822_6mm-d-shaft-collar-clamp-2-piece_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76294-10",
    "name": "3mm Pattern Spacer (10 pack)",
    "sku": "76294-10",
    "category": "Robot Parts",
    "description": "3mm Pattern Spacer (10 pack) · $5.99 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 3mm pattern spacer (10 pack) is designed for use with your Robotics builds and design.",
    "productUrl": "https://www.studica.com/3mm-pattern-spacer-10-pack",
    "imageUrl": "https://www.studica.com/images/thumbs/0014730_3mm-pattern-spacer-10-pack_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76295h",
    "name": "Clamping 6mm Hex-Shaft Hub-V2",
    "sku": "76295H",
    "category": "Robot Parts",
    "description": "Clamping 6mm Hex-Shaft Hub-V2 · $7.99 · Studica Robot Parts listing (collected Oct 2026) · Precision Hub for Hex-Shaft Couplings The Studica Robotics 6 mm Low Profile Hex-Shaft Clamping Hub V2 is engineered to deliver a secure and compact coupling between your motor or drive shaft and wheels, sprockets, or other mechanical components. With its 6 mm hex-shaft ID and low profile form, it's ideal for tight-space and high-precision builds. Made of aluminum, the Studica Robotics Clamping 6mm Hex-Shaft Hub-V2 is used with flex and drive wheels",
    "productUrl": "https://www.studica.com/clamping-6mm-hex-shaft-hub-v2-2",
    "imageUrl": "https://www.studica.com/images/thumbs/0018676_clamping-6mm-hex-shaft-hub-v2_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76299",
    "name": "6mm D-Shaft Face Bearing Block",
    "sku": "76299",
    "category": "Robot Parts",
    "description": "6mm D-Shaft Face Bearing Block · $10.89 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 6mm D-Shaft Face Bearing Block can be mounted on any channel and bracket allowing for a 6mm ID through hole for 6mm shafts (axles). The block has a permanently installed Standard Sealed Bearing and has 8 x M3 tapped through holes for easy mounting.",
    "productUrl": "https://www.studica.com/face-bearing-block",
    "imageUrl": "https://www.studica.com/images/thumbs/0014747_6mm-d-shaft-face-bearing-block_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76300-12",
    "name": "Bronze Bushing 6mm ID x 8mm OD (12 pack)",
    "sku": "76300-12",
    "category": "Robot Parts",
    "description": "Bronze Bushing 6mm ID x 8mm OD (12 pack) · $7.59 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics bronze bushing 12-pack is ideal for robotics design builds.",
    "productUrl": "https://www.studica.com/bronze-bushing-6mm-id-8mm-od-12-pack",
    "imageUrl": "https://www.studica.com/images/thumbs/0009826_bronze-bushing-6mm-id-x-8mm-od-12-pack_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76301-12",
    "name": "Bronze Bushing 6mm ID x 14mm OD (12 pack)",
    "sku": "76301-12",
    "category": "Robot Parts",
    "description": "Bronze Bushing 6mm ID x 14mm OD (12 pack) · $25.99 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics Bronze Bushing 6mm ID x 14mm OD fits any of channel or flat bracket having the common center hole pattern of 14mm. The inside diameter will fit any of the D-Shaft axles.",
    "productUrl": "https://www.studica.com/bronze-bushing-6mm-id-14mm-od-12-pack",
    "imageUrl": "https://www.studica.com/images/thumbs/0009839_bronze-bushing-6mm-id-x-14mm-od-12-pack_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76302-12",
    "name": "6mm ID Flanged Bearing (12 pack)",
    "sku": "76302-12",
    "category": "Robot Parts",
    "description": "6mm ID Flanged Bearing (12 pack) · $19.99 · Studica Robot Parts listing (collected Oct 2026) · The 6mm ID Round Flanged Bearing fits any of the channel and flat brackets with the common hole pattern having a center hole of 14mm. The inside diameter will fit any of the D-Shaft axles.",
    "productUrl": "https://www.studica.com/flanged-ball-bearing-6mm-id-14mm-od-15mm-fod-12-pack",
    "imageUrl": "https://www.studica.com/images/thumbs/0017660_6mm-id-flanged-bearing-12-pack_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76302h-12",
    "name": "6mm Hex-Shaft Flanged Bearing (12 pack)",
    "sku": "76302H-12",
    "category": "Robot Parts",
    "description": "6mm Hex-Shaft Flanged Bearing (12 pack) · $22.99 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 6mm Hex-Shaft Flanged Bearing fits any of the channel and flat brackets with the common hole pattern having a center hole of 14mm. The inside diameter will fit any of the 6mm Hex-Shaft axles.",
    "productUrl": "https://www.studica.com/6mm-hex-shaft-flanged-bearing-12-pack",
    "imageUrl": "https://www.studica.com/images/thumbs/0017653_6mm-hex-shaft-flanged-bearing-12-pack_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76303-2",
    "name": "6mm D-Shaft Coupling 12mm OD (2 pack)",
    "sku": "76303-2",
    "category": "Robot Parts",
    "description": "6mm D-Shaft Coupling 12mm OD (2 pack) · $5.49 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics D-Shaft Coupling has an ID of 6mm and an OD of 12mm. It can be used with the 6mm D-Shaft Axle and a 6mm shaft DC motor.",
    "productUrl": "https://www.studica.com/shaft-coupling-6mm-id-12mm-od-2-pack",
    "imageUrl": "https://www.studica.com/images/thumbs/0004117_6mm-d-shaft-coupling-12mm-od-2-pack_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76309-25",
    "name": "1mm Thick M3 Screw Spacer (25 pack)",
    "sku": "76309-25",
    "category": "Robot Parts",
    "description": "1mm Thick M3 Screw Spacer (25 pack) · $4.99 · Studica Robot Parts listing (collected Oct 2026) · A Studica Robotics 1mm, 3M screw spacer (25 pack), for use with robotics design builds.",
    "productUrl": "https://www.studica.com/1mm-thick-3m-screw-spacer-25-pack",
    "imageUrl": "https://www.studica.com/images/thumbs/0013981_1mm-thick-m3-screw-spacer-25-pack_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76320",
    "name": "6mm D-Shaft Collar Clamp",
    "sku": "76320",
    "category": "Robot Parts",
    "description": "6mm D-Shaft Collar Clamp · $4.99 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 6mm D-shaft collar clamp cay be used with the 6mm D-Shape Shaft to secure wheels in their position.",
    "productUrl": "https://www.studica.com/6mm-d-shape-collar-clamp",
    "imageUrl": "https://www.studica.com/images/thumbs/0008682_6mm-d-shaft-collar-clamp_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76325-12",
    "name": "Small Thrust Ball Bearing 6mm ID, 12mm OD (12 pack)",
    "sku": "76325-12",
    "category": "Robot Parts",
    "description": "Small Thrust Ball Bearing 6mm ID, 12mm OD (12 pack) · $14.99 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics Small Thrust Ball Bearing is used for vertical and axial loads to withstand heavy loads. These ball bearings have track grooves on the upper and lower track boards to reduce friction. Use these with structure for any hole where an axial load will be applied.",
    "productUrl": "https://www.studica.com/small-thrust-ball-bearing-6mm-id-12mm-od-12-pack",
    "imageUrl": "https://www.studica.com/images/thumbs/0013984_small-thrust-ball-bearing-6mm-id-12mm-od-12-pack_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76446",
    "name": "64 Tooth 5mm Pitch GT2 Belt",
    "sku": "76446",
    "category": "Robot Parts",
    "description": "64 Tooth 5mm Pitch GT2 Belt · $4.99 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 64-tooth 5mm pitch GT2 belt is ideal for your robotics design builds.",
    "productUrl": "https://www.studica.com/64-tooth-5mm-pitch-gt2-belt",
    "imageUrl": "https://www.studica.com/images/thumbs/0014854_64-tooth-5mm-pitch-gt2-belt_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76447",
    "name": "82 Tooth 5mm Pitch GT2 Belt",
    "sku": "76447",
    "category": "Robot Parts",
    "description": "82 Tooth 5mm Pitch GT2 Belt · $5.99 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 82-tooth 5mm pitch GT2 belt is ideal for your robotics design builds.",
    "productUrl": "https://www.studica.com/82-tooth-5mm-pitch-gt2-belt",
    "imageUrl": "https://www.studica.com/images/thumbs/0014853_82-tooth-5mm-pitch-gt2-belt_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76448",
    "name": "12 Tooth 5mm Pitch GT2 D-Shaft Pulley",
    "sku": "76448",
    "category": "Robot Parts",
    "description": "12 Tooth 5mm Pitch GT2 D-Shaft Pulley · $8.49 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 12 Tooth 5mm Pitch GT2 D-Shaft Pulley is ideal for your robotics design builds.",
    "productUrl": "https://www.studica.com/12-tooth-5mm-pitch-gt2-pulley",
    "imageUrl": "https://www.studica.com/images/thumbs/0014850_12-tooth-5mm-pitch-gt2-d-shaft-pulley_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76449",
    "name": "24 Tooth 5mm Pitch GT2 D-Shaft Pulley",
    "sku": "76449",
    "category": "Robot Parts",
    "description": "24 Tooth 5mm Pitch GT2 D-Shaft Pulley · $10.99 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 24 Tooth 5mm Pitch GT2 D-Shaft Pulley is ideal for your robotics design builds.",
    "productUrl": "https://www.studica.com/24-tooth-5mm-pitch-gt2-pulley",
    "imageUrl": "https://www.studica.com/images/thumbs/0014851_24-tooth-5mm-pitch-gt2-d-shaft-pulley_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76450",
    "name": "20 Tooth GT2-6mm Timing Belt D-Shaft Pulley",
    "sku": "76450",
    "category": "Robot Parts",
    "description": "20 Tooth GT2-6mm Timing Belt D-Shaft Pulley · $8.49 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 20 Tooth GT2-6mm Timing Belt D-Shaft Pulley can be used with any of the GT2 belts.",
    "productUrl": "https://www.studica.com/20-tooth-gt2-6mm-timing-belt-pulley",
    "imageUrl": "https://www.studica.com/images/thumbs/0008684_20-tooth-gt2-6mm-timing-belt-d-shaft-pulley_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76451",
    "name": "30 Tooth GT2-6mm Timing Belt D-Shaft Pulley",
    "sku": "76451",
    "category": "Robot Parts",
    "description": "30 Tooth GT2-6mm Timing Belt D-Shaft Pulley · $9.99 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 30 Tooth GT2-6mm Timing Belt D-Shaft Pulley can be used with any of the GT2 belts in your robotics builds.",
    "productUrl": "https://www.studica.com/30-tooth-gt2-6mm-timing-belt-pulley",
    "imageUrl": "https://www.studica.com/images/thumbs/0008685_30-tooth-gt2-6mm-timing-belt-d-shaft-pulley_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76452",
    "name": "40 Tooth GT2-6mm Timing Belt D-Shaft Pulley",
    "sku": "76452",
    "category": "Robot Parts",
    "description": "40 Tooth GT2-6mm Timing Belt D-Shaft Pulley · $10.99 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 40 Tooth GT2-6mm Timing Belt D-Shaft Pulley can be used with any of the GT2 belts in your robotics builds.",
    "productUrl": "https://www.studica.com/40-tooth-gt2-6mm-timing-belt-pulley",
    "imageUrl": "https://www.studica.com/images/thumbs/0008687_40-tooth-gt2-6mm-timing-belt-d-shaft-pulley_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76453",
    "name": "60 Tooth GT2-6mm Timing Belt D-Shaft Pulley",
    "sku": "76453",
    "category": "Robot Parts",
    "description": "60 Tooth GT2-6mm Timing Belt D-Shaft Pulley · $12.99 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 60 Tooth GT2-6mm Timing Belt D-Shaft Pulley can be used with any of the GT2 belts in your robotics builds.",
    "productUrl": "https://www.studica.com/60-tooth-gt2-6mm-timing-belt-pulley",
    "imageUrl": "https://www.studica.com/images/thumbs/0008688_60-tooth-gt2-6mm-timing-belt-d-shaft-pulley_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76454",
    "name": "80 Tooth GT2-6mm Timing Belt D-Shaft Pulley",
    "sku": "76454",
    "category": "Robot Parts",
    "description": "80 Tooth GT2-6mm Timing Belt D-Shaft Pulley · $13.99 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 80 Tooth GT2-6mm Timing Belt D-Shaft Pulley can be used with any of the GT2 belts in your robotics builds.",
    "productUrl": "https://www.studica.com/80-tooth-gt2-6mm-timing-belt-pulley",
    "imageUrl": "https://www.studica.com/images/thumbs/0008689_80-tooth-gt2-6mm-timing-belt-d-shaft-pulley_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76455",
    "name": "GT2-6mm Smooth Idler Pulley, H Type, w/3mm Inner Bore Bearing",
    "sku": "76455",
    "category": "Robot Parts",
    "description": "GT2-6mm Smooth Idler Pulley, H Type, w/3mm Inner Bore Bearing · $7.49 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics GT2-6mm Smooth Idler Pulley, H Type, w/3mm Inner Bore Bearing is ideal for your robotics design builds.",
    "productUrl": "https://www.studica.com/gt2-6mm-smooth-idler-pulleytype-w-3mm-inner-bore-bearing",
    "imageUrl": "https://www.studica.com/images/thumbs/0008690_gt2-6mm-smooth-idler-pulley-h-type-w3mm-inner-bore-bearing_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76457-2",
    "name": "GT2 Timing Belt, 2mm Pitch, 6mm width, 108mm Closed, (2 pack)",
    "sku": "76457-2",
    "category": "Robot Parts",
    "description": "GT2 Timing Belt, 2mm Pitch, 6mm width, 108mm Closed, (2 pack) · $4.99 · Studica Robot Parts listing (collected Oct 2026) · This GT2 (also called 2GT) timing belt has a 2mm Pitch and 6mm width. Specifications: type: GT2 closed-loop 108mm teeth: 54 pitch: 2 mm width: 6 mm material: neoprene rubber, fiberglass reinforced belt shape: circular tooth profile",
    "productUrl": "https://www.studica.com/gt2-timing-belt-2mm-pitch-6mm-width-108mm-closed-2-pack",
    "imageUrl": "https://www.studica.com/images/thumbs/0008692_gt2-timing-belt-2mm-pitch-6mm-width-108mm-closed-2-pack_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76458-2",
    "name": "GT2 Timing Belt, 2mm Pitch, 6mm width, 140mm Closed, (2 pack)",
    "sku": "76458-2",
    "category": "Robot Parts",
    "description": "GT2 Timing Belt, 2mm Pitch, 6mm width, 140mm Closed, (2 pack) · $5.49 · Studica Robot Parts listing (collected Oct 2026) · This GT2 (also called 2GT) timing belt has a 2mm Pitch and 6mm width. Specifications: type: GT2 closed-loop 140mm pitch: 2 mm width: 6 mm material: neoprene rubber, fiberglass reinforced belt shape: circular tooth profile",
    "productUrl": "https://www.studica.com/gt2-timing-belt-2mm-pitch-6mm-width-140mm-closed-2-pack",
    "imageUrl": "https://www.studica.com/images/thumbs/0008693_gt2-timing-belt-2mm-pitch-6mm-width-140mm-closed-2-pack_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76459-2",
    "name": "GT2 Timing Belt, 2mm Pitch, 6mm width, 190mm Closed, (2 pack)",
    "sku": "76459-2",
    "category": "Robot Parts",
    "description": "GT2 Timing Belt, 2mm Pitch, 6mm width, 190mm Closed, (2 pack) · $6.59 · Studica Robot Parts listing (collected Oct 2026) · This GT2 (also called 2GT) timing belt has a 2mm Pitch and 6mm width. Specifications: type: GT2 closed-loop 190mm teeth: 95 pitch: 2 mm width: 6 mm material: neoprene rubber, fiberglass reinforced belt shape: circular tooth profile",
    "productUrl": "https://www.studica.com/gt2-timing-belt-2mm-pitch-6mm-width-190mm-closed-2-pack",
    "imageUrl": "https://www.studica.com/images/thumbs/0008694_gt2-timing-belt-2mm-pitch-6mm-width-190mm-closed-2-pack_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76460-2",
    "name": "GT2 Timing Belt, 2mm Pitch, 6mm width, 240mm Closed, (2 pack)",
    "sku": "76460-2",
    "category": "Robot Parts",
    "description": "GT2 Timing Belt, 2mm Pitch, 6mm width, 240mm Closed, (2 pack) · $7.59 · Studica Robot Parts listing (collected Oct 2026) · This GT2 (also called 2GT) timing belt has a 2mm Pitch and 6mm width. Specifications: type: GT2 closed-loop 240mm teeth: 120 pitch: 2 mm width: 6 mm material: neoprene rubber, fiberglass reinforced belt shape: circular tooth profile",
    "productUrl": "https://www.studica.com/gt2-timing-belt-2mm-pitch-6mm-width-240mm-closed-2-pack",
    "imageUrl": "https://www.studica.com/images/thumbs/0008696_gt2-timing-belt-2mm-pitch-6mm-width-240mm-closed-2-pack_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76461-2",
    "name": "GT2 Timing Belt, 2mm Pitch, 6mm width, 330mm Closed, (2 pack)",
    "sku": "76461-2",
    "category": "Robot Parts",
    "description": "GT2 Timing Belt, 2mm Pitch, 6mm width, 330mm Closed, (2 pack) · $8.59 · Studica Robot Parts listing (collected Oct 2026) · This GT2 (also called 2GT) timing belt has a 2mm Pitch and 6mm width.",
    "productUrl": "https://www.studica.com/gt2-timing-belt-2mm-pitch-6mm-width-330mm-closed-2-pack",
    "imageUrl": "https://www.studica.com/images/thumbs/0008697_gt2-timing-belt-2mm-pitch-6mm-width-330mm-closed-2-pack_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76462-2",
    "name": "GT2 Timing Belt, 2mm Pitch, 6mm width, 630mm Closed, (2 pack)",
    "sku": "76462-2",
    "category": "Robot Parts",
    "description": "GT2 Timing Belt, 2mm Pitch, 6mm width, 630mm Closed, (2 pack) · $9.99 · Studica Robot Parts listing (collected Oct 2026) · This GT2 (also called 2GT) timing belt has a 2mm Pitch and 6mm width. Specifications: type: GT2 closed-loop 630mm teeth: 315 pitch: 2 mm width: 6 mm material: neoprene rubber, fiberglass reinforced belt shape: circular tooth profile",
    "productUrl": "https://www.studica.com/gt2-timing-belt-2mm-pitch-6mm-width-630mm-closed-2-pack",
    "imageUrl": "https://www.studica.com/images/thumbs/0008698_gt2-timing-belt-2mm-pitch-6mm-width-630mm-closed-2-pack_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76463-2",
    "name": "GT2 Timing Belt, 2mm Pitch, 6mm width, 810mm Closed, (2 pack)",
    "sku": "76463-2",
    "category": "Robot Parts",
    "description": "GT2 Timing Belt, 2mm Pitch, 6mm width, 810mm Closed, (2 pack) · $10.99 · Studica Robot Parts listing (collected Oct 2026) · This GT2 (also called 2GT) timing belt has a 2mm Pitch and 6mm width. Specifications: type: GT2 closed-loop 810mm teeth: 405 pitch: 2 mm width: 6 mm material: neoprene rubber, fiberglass reinforced belt shape: circular tooth profile",
    "productUrl": "https://www.studica.com/gt2-timing-belt-2mm-pitch-6mm-width-810mm-closed-2-pack",
    "imageUrl": "https://www.studica.com/images/thumbs/0008699_gt2-timing-belt-2mm-pitch-6mm-width-810mm-closed-2-pack_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76464-2",
    "name": "GT2 Timing Belt, 2mm Pitch, 6mm width, 1000mm Open, (2 pack)",
    "sku": "76464-2",
    "category": "Robot Parts",
    "description": "GT2 Timing Belt, 2mm Pitch, 6mm width, 1000mm Open, (2 pack) · $10.99 · Studica Robot Parts listing (collected Oct 2026) · This GT2 (also called 2GT) timing belt has a 2mm Pitch, 6mm width, and open 1000mm in length. Use any of the GT2 pulleys from Studica and the clamp kit. Specifications: type: GT2 open-loop pitch: 2 mm width: 6 mm material: neoprene rubber, fiberglass reinforced belt shape: circular tooth profile",
    "productUrl": "https://www.studica.com/gt2-timing-belt-2mm-pitch-6mm-width-1000mm-open-2-pack",
    "imageUrl": "https://www.studica.com/images/thumbs/0008700_gt2-timing-belt-2mm-pitch-6mm-width-1000mm-open-2-pack_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76465-2",
    "name": "GT2 Timing Belt, 2mm Pitch, 6mm width, 160mm Closed, (2 pack)",
    "sku": "76465-2",
    "category": "Robot Parts",
    "description": "GT2 Timing Belt, 2mm Pitch, 6mm width, 160mm Closed, (2 pack) · $5.99 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 160mm closed-loop 6mm GT2 timing belt (2 pack) has a 2mm pitch and a 6mm width.",
    "productUrl": "https://www.studica.com/gt2-timing-belt-2mm-pitch-6mm-width-160mm-closed-2-pack",
    "imageUrl": "https://www.studica.com/images/thumbs/0014230_gt2-timing-belt-2mm-pitch-6mm-width-160mm-closed-2-pack_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76500",
    "name": "30 Tooth D-Shaft Gear",
    "sku": "76500",
    "category": "Robot Parts",
    "description": "30 Tooth D-Shaft Gear · $10.99 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 30 Tooth D-Shaft Gear is ideal for use with robotics design builds.",
    "productUrl": "https://www.studica.com/30-tooth-gear",
    "imageUrl": "https://www.studica.com/images/thumbs/0014818_30-tooth-d-shaft-gear_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76501",
    "name": "90 Tooth D-Shaft Gear",
    "sku": "76501",
    "category": "Robot Parts",
    "description": "90 Tooth D-Shaft Gear · $14.99 · Studica Robot Parts listing (collected Oct 2026) · A Studica Robotics 90 Tooth D-Shaft Gear for use with robotics design builds.",
    "productUrl": "https://www.studica.com/90-tooth-gear",
    "imageUrl": "https://www.studica.com/images/thumbs/0014811_90-tooth-d-shaft-gear_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76502-6",
    "name": "Threaded Joiner Plate (6 pack)",
    "sku": "76502-6",
    "category": "Robot Parts",
    "description": "Threaded Joiner Plate (6 pack) · $13.99 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics Threaded Joiner Plate can be used to join two different structure components together, such as U-Channels and brackets.",
    "productUrl": "https://www.studica.com/threaded-joiner-plate-6-pack",
    "imageUrl": "https://www.studica.com/images/thumbs/0014231_threaded-joiner-plate-6-pack_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "76503-6",
    "name": "Threaded Pattern Plate (6 pack)",
    "sku": "76503-6",
    "category": "Robot Parts",
    "description": "Threaded Pattern Plate (6 pack) · $13.99 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics Threaded Pattern Plate (6-pack) can be used to join two different structural components together.",
    "productUrl": "https://www.studica.com/threaded-pattern-plate-6-pack",
    "imageUrl": "https://www.studica.com/images/thumbs/0014232_threaded-pattern-plate-6-pack_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "77223d",
    "name": "13 and 26 Tooth D-Shaft Helical Bevel Gear Set",
    "sku": "77223D",
    "category": "Robot Parts",
    "description": "13 and 26 Tooth D-Shaft Helical Bevel Gear Set · $27.49 · Studica Robot Parts listing (collected Oct 2026) · Enhance your robotics projects with the Studica Robotics 13 and 26 Tooth D-Shaft Helical Bevel Gear Set. Designed for precision and durability, this gear set made of titanium-plated 20CrMnTi hardened steel is perfect for robotics applications, offering smooth operation and reliable performance. Ideal for FTC custom robot builds and gear systems.",
    "productUrl": "https://www.studica.com/13-and-26-tooth-d-shaft-helical-bevel-gear-set",
    "imageUrl": "https://www.studica.com/images/thumbs/0018530_13-and-26-tooth-d-shaft-helical-bevel-gear-set_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "77223h",
    "name": "13 and 26 Tooth Hex-Shaft Helical Bevel Gear Set",
    "sku": "77223H",
    "category": "Robot Parts",
    "description": "13 and 26 Tooth Hex-Shaft Helical Bevel Gear Set · $27.49 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 13 and 26 Tooth Hex Shaft Helical Bevel Gear Set is a precision-engineered component designed for robotics applications, particularly within the FIRST Tech Challenge (FTC) community. This gear set made of titanium-plated hardened steel enables efficient power transmission and precise motion control in robotic systems.",
    "productUrl": "https://www.studica.com/13-and-26-tooth-hex-shaft-helical-bevel-gear-set",
    "imageUrl": "https://www.studica.com/images/thumbs/0018210_13-and-26-tooth-hex-shaft-helical-bevel-gear-set_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "77224d",
    "name": "36 Tooth D-Shaft Helical Bevel Gear 1 to 1 Set",
    "sku": "77224D",
    "category": "Robot Parts",
    "description": "36 Tooth D-Shaft Helical Bevel Gear 1 to 1 Set · $32.99 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 36-Tooth D-Shaft Helical Bevel Gear 1:1 Set is designed for smooth and efficient power transmission. This precision-engineered gear set made of zinc-plated 20CrMnTi hardened steel is perfect for FTC and STEM applications.",
    "productUrl": "https://www.studica.com/36-tooth-d-shaft-helical-bevel-gear-1-to-1-set",
    "imageUrl": "https://www.studica.com/images/thumbs/0018209_36-tooth-d-shaft-helical-bevel-gear-1-to-1-set_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "77224h",
    "name": "36 Tooth Hex-Shaft Helical Bevel Gear 1 to 1 Set",
    "sku": "77224H",
    "category": "Robot Parts",
    "description": "36 Tooth Hex-Shaft Helical Bevel Gear 1 to 1 Set · $32.99 · Studica Robot Parts listing (collected Oct 2026) · The Studica Robotics 36-Tooth Hex Shaft Helical Bevel Gear 1:1 Set is designed to enhance motion control in robotics applications. This gear set, made of titanium-plated hardened steel features helical bevel gears with 36 teeth, optimized for use with 6mm hex shafts, providing a 1:1 gear ratio. Ideal for transmitting motion between perpendicular shafts, it ensures smooth and efficient power transfer in your robotic designs.",
    "productUrl": "https://www.studica.com/36-tooth-hex-shaft-helical-bevel-gear-1-to-1-set",
    "imageUrl": "https://www.studica.com/images/thumbs/0018208_36-tooth-hex-shaft-helical-bevel-gear-1-to-1-set_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "am-2964b",
    "name": "NeveRest Classic 40 Gearmotor, JST-VH-2 Connector",
    "sku": "am-2964b",
    "category": "Robot Parts",
    "description": "NeveRest Classic 40 Gearmotor, JST-VH-2 Connector · $19.00 · Studica Robot Parts listing (collected Oct 2026) · The NeveRest 40 is a gearmotor with an attached encoder. The output shaft geometry and the gearbox housing diameter is similar to what FTC teams are familiar with. The shaft is a 6 mm D and the gearbox housing is 37 mm diameter.",
    "productUrl": "https://www.studica.com/neverest-classic-40-gearmotor-jst-vh-2-connector",
    "imageUrl": "https://www.studica.com/images/thumbs/0018674_neverest-classic-40-gearmotor-jst-vh-2-connector_200.jpeg"
  },
  {
    "vendorKey": "studica",
    "externalKey": "am-4609b",
    "name": "NeveRest Orbital Gearmotor (Gear Ratio: 50.9 to 1) JST-VH-2 Connector",
    "sku": "am-4609b",
    "category": "Robot Parts",
    "description": "NeveRest Orbital Gearmotor (Gear Ratio: 50.9 to 1) JST-VH-2 Connector · $22.00 · Studica Robot Parts listing (collected Oct 2026) · The NeveRest Orbital gearmotor is a robust planetary gearmotor designed for FTC. With many ratios to choose from you can find the right motor for you, from a fast spinning intake to a high reduction arm, all are possible with NeveRest Orbitals. They have a pre-installed encoder and an output shaft directly in the center of the output face. The shaft is a 6 mm D and the gearbox housing is 37 mm in diameter.",
    "productUrl": "https://www.studica.com/neverest-orbital-gearmotor-gear-ratio-509-to-1-jst-vh-2-connector",
    "imageUrl": "https://www.studica.com/images/thumbs/0018675_neverest-orbital-gearmotor-gear-ratio-509-to-1-jst-vh-2-connector_200.jpeg"
  }
];
