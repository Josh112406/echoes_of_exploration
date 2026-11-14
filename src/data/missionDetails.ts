export interface MissionExtraDetail {
  sprite: string;
  decade: string;
  memoryEcho: string;
  archivistNote: string;
  instruments: string[];
  constraint: string;
  measurements: string;
  uncertaintyNote: string;
  relatedIds: string[];
  authenticCredit: string;
  authenticLabel: string;
}

export const STATUS_LABELS: Record<string, { label: string; tone: 'cyan' | 'amber' | 'muted' | 'rust' }> = {
  'active-primary': { label: 'Active Primary', tone: 'cyan' },
  'active-extended': { label: 'Active Extended', tone: 'cyan' },
  'passive-science': { label: 'Passive Science', tone: 'cyan' },
  'completed-surface': { label: 'Completed on Surface', tone: 'amber' },
  'completed-orbit': { label: 'Completed in Orbit', tone: 'amber' },
  'silent-location-known': { label: 'Silent · Location Known', tone: 'amber' },
  'silent-location-approximate': { label: 'Silent · Approximate Path', tone: 'muted' },
  'intentionally-impacted': { label: 'Intentionally Impacted', tone: 'muted' },
  'unintentionally-impacted': { label: 'Unintentionally Impacted', tone: 'rust' },
  'lost-or-unknown': { label: 'Lost / Unknown', tone: 'muted' },
};

export const MISSION_DETAILS: Record<string, MissionExtraDetail> = {
  'ranger-7-9': {
    sprite: '/assets/generated/sprites/surveyor-casing.png',
    decade: '1960s',
    memoryEcho:
      'No parachutes, no landing legs—just six television cameras falling toward the Sea of Clouds, sending frame after frame until the signal cut out at impact.',
    archivistNote:
      'Rangers 7, 8, and 9 were designed as hard-impact lunar probes. Before humans could land on the Moon, engineers needed to know if lunar dust was solid rock or deep quicksand.',
    instruments: ['Six Vidicon Television Cameras (2 wide-angle, 4 narrow-angle)'],
    constraint: 'High-speed approach (~2.6 km/s) meant imaging had to transmit instantaneously via analog telemetry with zero onboard storage.',
    measurements: 'Ranger 7 returned 4,308 photographs in its final 17 minutes, resolving craters down to ~0.4 meters across.',
    uncertaintyNote: 'Close-up images showed craters at every scale, but bearing strength still had to be confirmed directly by Surveyor landers.',
    relatedIds: ['lunar-orbiter-program', 'surveyor-1'],
    authenticCredit: 'NASA / JPL — Ranger Program Archive',
    authenticLabel: 'Official NASA mission record (Illustration shown in-game)',
  },
  'lunar-orbiter-program': {
    sprite: '/assets/generated/sprites/retro-casing.png',
    decade: '1960s',
    memoryEcho:
      'Five flying darkrooms circling above the lunar horizon, developing film in orbit and scanning light strips across empty space back to Earth.',
    archivistNote:
      'Lunar Orbiters 1 through 5 photographed 99% of the Moon’s surface. After mapping Apollo landing candidates, each orbiter was commanded to impact the Moon so it would not interfere with future missions.',
    instruments: ['Dual-lens Kodak 70mm Film Camera', 'Automated Film Processor & Scanner', 'Micrometeoroid & Radiation Detectors'],
    constraint: 'Digital sensors did not exist at the needed resolution, requiring onboard wet-film processing in microgravity.',
    measurements: 'Resolutions up to ~1–2 meters on prime Apollo candidate ellipses across the lunar equator.',
    uncertaintyNote: 'Gravity anomalies ("mascons") discovered via Lunar Orbiter radio tracking required Apollo navigation models to be revised.',
    relatedIds: ['ranger-7-9', 'apollo-11-surface'],
    authenticCredit: 'NASA Langley / Boeing — Lunar Orbiter Archive',
    authenticLabel: 'Official NASA mission record (Illustration shown in-game)',
  },
  'surveyor-1': {
    sprite: '/assets/generated/sprites/surveyor.png',
    decade: '1960s',
    memoryEcho:
      'The ground rushed upward through the radar cone. A burst from three liquid engines, a sudden silence of freefall, and three round footpads pressed gently into Oceanus Procellarum.',
    archivistNote:
      'Surveyor 1 performed the first U.S. soft landing on another celestial body on June 2, 1966. Its autonomous radar altimeter and Doppler velocity sensor controlled three vernier thrusters without real-time joystick piloting from Earth.',
    instruments: ['Radar Altimeter & Doppler Velocity Sensor (RADVS)', 'Survey Television Camera', 'Strain Gauges on Landing Legs'],
    constraint: '2.5-second round-trip radio light delay made manual Earth piloting impossible; the descent sequence had to execute automatically.',
    measurements: 'Touched down at ~3.4 m/s after vernier cutoff at 3.4 m altitude; transmitted 11,237 surface photographs.',
    uncertaintyNote: 'Before Surveyor 1, some models feared deep electrostatically suspended dust might swallow a heavy lander.',
    relatedIds: ['ranger-7-9', 'surveyor-3', 'apollo-11-surface'],
    authenticCredit: 'NASA / JPL — Surveyor 1 NSSDCA Archive',
    authenticLabel: 'Official NASA mission record (Illustration shown in-game)',
  },
  'surveyor-3': {
    sprite: '/assets/generated/sprites/surveyor-scoop.png',
    decade: '1960s',
    memoryEcho:
      'I dug four small trenches in the Mare Cognitum dust and waited in the cold lunar vacuum. Two and a half years later, boots walked down my crater slope to say hello.',
    archivistNote:
      'Surveyor 3 landed in April 1967 with a surface soil sampler scoop. In November 1969, Apollo 12 astronauts Pete Conrad and Alan Bean landed within walking distance and retrieved its television camera and scoop for laboratory analysis on Earth.',
    instruments: ['Soil Mechanics Surface Sampler Scoop', 'Pan-Tilt Television Camera'],
    constraint: 'Bounced twice during landing because radar momentarily lost lock, leaving the craft tilted inside a small crater.',
    measurements: 'Dug trenches up to 18 cm deep; hardware returned by Apollo 12 underwent 31 months of lunar vacuum/radiation exposure.',
    uncertaintyNote: 'Reports of microbes found inside the returned camera were later scrutinized for cleanroom contamination controls.',
    relatedIds: ['surveyor-1', 'apollo-12-surface'],
    authenticCredit: 'NASA / JSC / JPL — Surveyor 3 & Apollo 12',
    authenticLabel: 'Official NASA mission record (Illustration shown in-game)',
  },
  'apollo-11-surface': {
    sprite: '/assets/generated/sprites/lrrr.png',
    decade: '1960s',
    memoryEcho:
      'No battery. No antenna. Just one hundred fused-silica corner cubes pointed silently toward Earth, waiting for a brief flash of green laser light to bounce straight home.',
    archivistNote:
      'While the Apollo 11 Eagle descent stage and seismic package completed their powered work long ago, the Lunar Laser Ranging Retroreflector (LRRR) uses pure optics to reflect Earth-based laser pulses back to observatories with zero onboard electricity.',
    instruments: ['100-Corner-Cube Fused Silica Retroreflector Array (LRRR)', 'Passive Seismic Experiment (EASEP)'],
    constraint: 'Out of 10^17 photons fired from Earth telescopes through atmospheric turbulence, only a handful return to the detector.',
    measurements: 'Earth–Moon distance (~384,400 km) measured to millimeter-to-centimeter precision; confirmed the Moon recedes at ~3.8 cm/year.',
    uncertaintyNote: 'Each single laser shot has atmospheric and photon-arrival noise; scientists average thousands of returns per observing session.',
    relatedIds: ['apollo-14-surface', 'apollo-15-surface', 'surveyor-1'],
    authenticCredit: 'NASA / International Laser Ranging Service (ILRS)',
    authenticLabel: 'Official NASA/ILRS mission record (Illustration shown in-game)',
  },
  'apollo-12-surface': {
    sprite: '/assets/generated/sprites/lm-descent.png',
    decade: '1960s',
    memoryEcho:
      'Pinpoint descent through the Ocean of Storms—landing just 163 meters from an old robotic pioneer so crew and machine could share the same horizon.',
    archivistNote:
      'Apollo 12 proved precision lunar landing by touching down near Surveyor 3 in November 1969 and deploying the first full nuclear-powered Apollo Lunar Surface Experiments Package (ALSEP).',
    instruments: ['ALSEP (Passive Seismometer, Magnetometer, Solar Wind Spectrometer)', 'LM Intrepid Descent Stage'],
    constraint: 'Tight landing ellipse required real-time optical landmark checks and automated guidance updates.',
    measurements: 'ALSEP station operated continuously until September 30, 1977 (~8 years of geophysical telemetry).',
    uncertaintyNote: 'Color TV camera failed early after accidental exposure to direct sunlight, prompting procedure changes for later flights.',
    relatedIds: ['surveyor-3', 'apollo-11-surface', 'apollo-14-surface'],
    authenticCredit: 'NASA Johnson Space Center — Apollo 12',
    authenticLabel: 'Official NASA mission record (Illustration shown in-game)',
  },
  'apollo-14-surface': {
    sprite: '/assets/generated/sprites/lrrr.png',
    decade: '1970s',
    memoryEcho:
      'Up the slopes toward Cone Crater with a two-wheeled equipment cart, leaving behind another passive mirror array in the rugged ejecta of Fra Mauro.',
    archivistNote:
      'Apollo 14 sampled ancient ejecta from the Imbrium basin at Fra Mauro and deployed a second laser retroreflector array that pairs with Apollo 11 and 15 to track lunar libration.',
    instruments: ['Apollo 14 Laser Retroreflector (100 cubes)', 'ALSEP Active Seismic & Suprathermal Ion Detectors'],
    constraint: 'Steep, boulder-strewn terrain slowed walking traverses and highlighted the need for powered rovers.',
    measurements: 'Collected 42.3 kg of lunar rocks; retroreflector continues providing ranging targets to ILRS stations.',
    uncertaintyNote: 'Astronauts halted just short of the exact Cone Crater rim due to topography and consumables safety margins.',
    relatedIds: ['apollo-11-surface', 'apollo-15-surface'],
    authenticCredit: 'NASA / ILRS — Apollo 14 Fra Mauro',
    authenticLabel: 'Official NASA/ILRS mission record (Illustration shown in-game)',
  },
  'apollo-15-surface': {
    sprite: '/assets/generated/sprites/lrv.png',
    decade: '1970s',
    memoryEcho:
      'Wire-mesh wheels rolled off the lander ramp and kicked pale dust into a vacuum arc—suddenly kilometers of canyons and mountains lay within reach.',
    archivistNote:
      'Apollo 15 introduced the first Lunar Roving Vehicle (LRV-1) and a larger 300-cube retroreflector at Hadley–Apennine, transforming Apollo into full scientific expeditions.',
    instruments: ['Lunar Roving Vehicle (LRV-1)', '300-Cube Laser Retroreflector', 'ALSEP Heat Flow & Seismometer'],
    constraint: 'Maximum distance from the Lunar Module was bounded by the astronauts’ safe walk-back limit in case the rover broke down.',
    measurements: 'Drove 27.9 km across Hadley Rille and Mons Hadley Delta; returned 77 kg of samples including the Genesis Rock.',
    uncertaintyNote: 'Deep drilling for heat-flow probes encountered harder subsurface rock than pre-mission estimates predicted.',
    relatedIds: ['apollo-14-surface', 'apollo-16-surface', 'apollo-17-surface'],
    authenticCredit: 'NASA — Apollo 15 Hadley–Apennine',
    authenticLabel: 'Official NASA mission record (Illustration shown in-game)',
  },
  'apollo-16-surface': {
    sprite: '/assets/generated/sprites/lrv.png',
    decade: '1970s',
    memoryEcho:
      'We drove into the bright lunar highlands expecting ancient lava flows, and instead cracked open impact-shattered breccia from the Moon’s earliest crust.',
    archivistNote:
      'Apollo 16 explored the Descartes Highlands with LRV-2, overturning pre-mission geological predictions by showing the highland plains were shaped by colossal basin impacts rather than volcanoes.',
    instruments: ['LRV-2 Electric Rover', 'Far Ultraviolet Camera/Spectrograph', 'ALSEP Geophysical Station'],
    constraint: 'Rough highland craters demanded careful obstacle routing while preserving rover battery charge and EVA oxygen.',
    measurements: 'Traversed 26.7 km across three EVAs and returned 95.7 kg of lunar highland samples.',
    uncertaintyNote: 'Pre-landing geological maps had interpreted Descartes morphology as volcanic domes—corrected directly by field samples.',
    relatedIds: ['apollo-15-surface', 'apollo-17-surface'],
    authenticCredit: 'NASA — Apollo 16 Descartes Highlands',
    authenticLabel: 'Official NASA mission record (Illustration shown in-game)',
  },
  'apollo-17-surface': {
    sprite: '/assets/generated/sprites/lrv.png',
    decade: '1970s',
    memoryEcho:
      'Three days across Taurus–Littrow. At Shorty Crater, a smear of bright orange beads stopped us in our tracks—ancient lunar fire frozen into glass.',
    archivistNote:
      'Apollo 17 carried the first professional geologist to walk on the Moon (Harrison Schmitt) and drove LRV-3 over 35.9 km across Taurus–Littrow valley. Its ALSEP geophones and instruments ran until 1977.',
    instruments: ['Lunar Roving Vehicle (LRV-3)', 'Lunar Seismic Profiling Geophones', 'Gravimeter & Atmospheric Composition Experiment'],
    constraint: 'Every route had to balance science value, time remaining, battery amp-hours, and the strict safe walk-back perimeter.',
    measurements: '35.9 km total traverse; 110.5 kg of samples returned including 3.64-billion-year-old orange pyroclastic glass beads.',
    uncertaintyNote: 'A damaged rear fender sprayed dust over instruments until crew improvised a replacement from laminated maps and tape.',
    relatedIds: ['apollo-15-surface', 'apollo-16-surface', 'spirit'],
    authenticCredit: 'NASA — Apollo 17 Mission Details',
    authenticLabel: 'Official NASA mission record (Illustration shown in-game)',
  },
  'viking-1': {
    sprite: '/assets/generated/sprites/viking.png',
    decade: '1970s',
    memoryEcho:
      'One scoop of red soil warmed inside a tiny oven. One chamber hissed with gas; another found no carbon molecules at all. Two instruments disagreed—and science stayed honest.',
    archivistNote:
      'Viking 1 achieved the first fully successful U.S. soft landing on Mars on July 20, 1976, and operated for over six years. Its miniature biology laboratory produced reactive chemical signals, while its Gas Chromatograph–Mass Spectrometer (GCMS) found no detectable organic molecules.',
    instruments: ['Biology Instrument (LR, GEx, PR experiments)', 'Gas Chromatograph–Mass Spectrometer (GCMS)', 'X-Ray Fluorescence Spectrometer & Meteorology Boom'],
    constraint: 'Automated soil experiments had to be miniaturized into a single 15 kg chamber and interpreted across 300+ million km.',
    measurements: 'Operated for 2,245 Martian sols in Chryse Planitia; Labeled Release detected 14CO2 evolution, whereas GCMS found <1 ppb organics.',
    uncertaintyNote: 'Combined evidence did not confirm or rule out Martian life; later discovery of perchlorates on Mars offered a non-biological chemical explanation for part of the discrepancy.',
    relatedIds: ['viking-2', 'phoenix', 'curiosity'],
    authenticCredit: 'NASA / JPL / Langley — Viking 1 Archive',
    authenticLabel: 'Official NASA mission record (Illustration shown in-game)',
  },
  'viking-2': {
    sprite: '/assets/generated/sprites/viking.png',
    decade: '1970s',
    memoryEcho:
      'Farther north in Utopia Planitia, winter frost settled white across rusty stones while I compared every weather gust and soil sample with my twin on the other side of the world.',
    archivistNote:
      'Viking 2 landed at Utopia Planitia on September 3, 1976, enabling simultaneous two-site Martian meteorology, seismology, and comparative biology/chemistry testing.',
    instruments: ['Biology Laboratory', 'GCMS', 'Dual Facsimile Cameras', 'Seismometer & Weather Sensors'],
    constraint: 'High northern latitude exposed the lander to seasonal frost and severe winter temperatures.',
    measurements: 'Operated until April 12, 1980 (1,281 sols), confirming similar reactive soil behavior and recording seasonal water-ice frost.',
    uncertaintyNote: 'Viking 2’s seismometer operated cleanly while Viking 1’s failed to uncage, yet Mars wind vibrations made distinguishing marsquakes difficult until InSight.',
    relatedIds: ['viking-1', 'phoenix'],
    authenticCredit: 'NASA / JPL — Viking 2 Archive',
    authenticLabel: 'Official NASA mission record (Illustration shown in-game)',
  },
  'mars-pathfinder': {
    sprite: '/assets/generated/sprites/pathfinder.png',
    decade: '1990s',
    memoryEcho:
      'Giant airbags bounced fifteen times across Ares Vallis, unfolded three solar petals, and watched a microwave-sized six-wheeled rover roll down onto Mars.',
    archivistNote:
      'Mars Pathfinder demonstrated low-cost airbag landing and deployed Sojourner, the first rover to operate on another planet, proving mobile geological exploration worked on Mars.',
    instruments: ['IMP Stereo Camera', 'Alpha Proton X-Ray Spectrometer (APXS on Sojourner)', 'Atmospheric Structure / Meteorology Package'],
    constraint: 'Sojourner weighed just 10.6 kg and communicated only through the Pathfinder base station via short-range UHF.',
    measurements: 'Returned 16,500 lander images, 550 Sojourner images, and 15 chemical analyses of rocks over 83 sols.',
    uncertaintyNote: 'Dust-coated solar panels and cold nights ended communications, though surface features hinted at ancient catastrophic floods in Ares Vallis.',
    relatedIds: ['spirit', 'opportunity'],
    authenticCredit: 'NASA / JPL — Mars Pathfinder & Sojourner',
    authenticLabel: 'Official NASA mission record (Illustration shown in-game)',
  },
  'spirit': {
    sprite: '/assets/generated/sprites/mer.png',
    decade: '2000s',
    memoryEcho:
      'My right-front wheel locked solid and carved a stubborn trench behind me. That broken wheel scraped aside the red crust—and uncovered pure white silica forged in ancient steam.',
    archivistNote:
      'Designed for 90 sols, Spirit explored Gusev Crater for over six years. In 2007, its immobilized front wheel dragged through the soil near Home Plate and exposed bright deposits ~90% rich in amorphous silica—strong evidence of past hot springs or volcanic steam.',
    instruments: ['Panoramic Camera (Pancam)', 'Miniature Thermal Emission Spectrometer (Mini-TES)', 'APXS & Mössbauer Spectrometer', 'Rock Abrasion Tool'],
    constraint: 'Winter solar power limits and a jammed right-front wheel forced backward driving and steep hillside tilting for sunlight.',
    measurements: 'Drove 7.73 km across Gusev Crater; identified silica-rich deposits (>90% SiO2) and carbonate-bearing outcrops at Comanche.',
    uncertaintyNote: 'Silica discovery proved localized past hydrothermal water at Home Plate, not that all of ancient Mars was a warm ocean.',
    relatedIds: ['opportunity', 'mars-pathfinder', 'perseverance'],
    authenticCredit: 'NASA / JPL / Cornell — Mars Exploration Rover Spirit',
    authenticLabel: 'Official NASA mission record (Illustration shown in-game)',
  },
  'opportunity': {
    sprite: '/assets/generated/sprites/mer.png',
    decade: '2000s',
    memoryEcho:
      'Ninety days turned into nearly fifteen years. Across Meridiani Planum, past Endeavour’s rim, until a planet-wide dust storm dimmed the sun to zero.',
    archivistNote:
      'Opportunity landed in January 2004 and drove 45.16 kilometers—longer than any off-Earth surface vehicle—documenting hematite spherules ("blueberries") and cross-bedded rocks formed in ancient liquid water.',
    instruments: ['Pancam', 'Mini-TES', 'Microscopic Imager', 'APXS & Mössbauer Spectrometer'],
    constraint: 'Solar-array dust accumulation and planet-encircling dust storms threatened battery survival each Martian winter.',
    measurements: '45.16 km total odometer across 5,111 active sols; confirmed ancient acidic and later neutral water environments.',
    uncertaintyNote: 'Final contact ended in June 2018 during a global dust storm; NASA concluded mission recovery efforts in February 2019.',
    relatedIds: ['spirit', 'curiosity'],
    authenticCredit: 'NASA / JPL — Mars Exploration Rover Opportunity',
    authenticLabel: 'Official NASA mission record (Illustration shown in-game)',
  },
  'phoenix': {
    sprite: '/assets/generated/sprites/phoenix.png',
    decade: '2000s',
    memoryEcho:
      'A robotic arm scraped two inches below the arctic polygons—and white specks glinted in the trench. Four sols later, those specks vanished into vapor.',
    archivistNote:
      'Phoenix landed in the Martian north polar plains in May 2008 and directly dug up and confirmed subsurface water ice, while measuring soil chemistry including perchlorates and calcium carbonate.',
    instruments: ['Robotic Arm & Camera', 'TEGA (Thermal and Evolved Gas Analyzer)', 'MECA Wet Chemistry & Microscopy Lab', 'Lidar'],
    constraint: 'Solar-powered polar lander could not survive the onset of Martian arctic winter darkness.',
    measurements: 'Operated 157 sols; observed exposed water ice sublimate over 4 sols and detected snow falling from high clouds via Lidar.',
    uncertaintyNote: 'Presence of perchlorate salts in arctic soil complicated thermal detection of organics, reshaping how Viking results are interpreted.',
    relatedIds: ['viking-1', 'insight'],
    authenticCredit: 'NASA / JPL / University of Arizona — Phoenix Lander',
    authenticLabel: 'Official NASA mission record (Illustration shown in-game)',
  },
  'curiosity': {
    sprite: '/assets/generated/sprites/msl.png',
    decade: '2010s',
    memoryEcho:
      'Lowered on nylon tethers beneath a hovering sky-crane, nuclear-warmed and still climbing Mount Sharp layer by stone layer through billions of years of Martian history.',
    archivistNote:
      'Curiosity landed in Gale Crater in August 2012 and continues an active extended mission climbing Aeolis Mons (Mount Sharp), demonstrating that ancient Gale Crater hosted freshwater lakes habitable for microbial life.',
    instruments: ['SAM (Sample Analysis at Mars)', 'CheMin X-Ray Diffraction', 'ChemCam Laser-Induced Breakdown Spectrometer', 'Mastcam & MAHLI'],
    constraint: 'Too heavy for airbags (~899 kg), requiring the rocket-powered Sky Crane precision descent system.',
    measurements: 'Identified ancient mudstones, organic carbon molecules, methane variations, and clay/sulfate transitions over >30 km of driving.',
    uncertaintyNote: 'Active extended mission status and odometer/findings continue updating; verify latest NASA mission status prior to publication.',
    relatedIds: ['opportunity', 'perseverance'],
    authenticCredit: 'NASA / JPL-Caltech — Mars Science Laboratory Curiosity',
    authenticLabel: 'Official NASA mission record (Illustration shown in-game)',
  },
  'insight': {
    sprite: '/assets/generated/sprites/insight.png',
    decade: '2010s',
    memoryEcho:
      'I never rolled an inch. I set a copper dome softly over the red sand, held my breath against the wind, and listened to the heartbeat of a planet.',
    archivistNote:
      'InSight landed on Elysium Planitia in 2018 and placed the SEIS seismometer directly onto Mars’s surface, detecting over 1,300 marsquakes and mapping the thickness of Mars’s crust, mantle, and liquid core.',
    instruments: ['SEIS (Seismic Experiment for Interior Structure)', 'HP3 Heat Flow Probe ("Mole")', 'RISE Radio Science Experiment'],
    constraint: 'Stationary solar arrays gradually lost power beneath thick Martian dust accumulation.',
    measurements: 'Detected >1,300 seismic events including meteoroid impacts; constrained core radius (~1,830 km) and crustal thickness.',
    uncertaintyNote: 'The HP3 thermal "mole" could not penetrate as deeply as planned because Martian soil cohesion differed from test assumptions.',
    relatedIds: ['apollo-12-surface', 'phoenix'],
    authenticCredit: 'NASA / JPL / CNES / DLR — InSight Mission',
    authenticLabel: 'Official NASA mission record (Illustration shown in-game)',
  },
  'perseverance': {
    sprite: '/assets/generated/sprites/msl.png',
    decade: '2020s',
    memoryEcho:
      'Core by sealed titanium tube, gathering fragments of an ancient river delta in Jezero Crater—waiting quietly for a future flight home.',
    archivistNote:
      'Perseverance landed in Jezero Crater in February 2021 with an astrobiology suite, oxygen-producing MOXIE demonstrator, and sample-caching drill, currently executing an active primary science campaign.',
    instruments: ['PIXL & SHERLOC Spectrometers', 'RIMFAX Ground-Penetrating Radar', 'MOXIE Oxygen Experiment', 'Adaptive Caching Assembly'],
    constraint: 'Hermetically sealing contamination-free rock cores requires multi-step robotic verification inside an abrasive dusty environment.',
    measurements: 'Produced breathable O2 from CO2 atmosphere via MOXIE and cached dozens of rock, regolith, and atmospheric tubes.',
    uncertaintyNote: 'Active primary mission status updates continually; verify current core count and traverse location against NASA Mars 2020.',
    relatedIds: ['curiosity', 'ingenuity', 'spirit'],
    authenticCredit: 'NASA / JPL-Caltech — Mars 2020 Perseverance',
    authenticLabel: 'Official NASA mission record (Illustration shown in-game)',
  },
  'ingenuity': {
    sprite: '/assets/generated/sprites/ingenuity.png',
    decade: '2020s',
    memoryEcho:
      'Air one-hundredth as thick as home. Twin carbon blades spun 2,537 times a minute—and for the first time, something lifted off another world.',
    archivistNote:
      'Designed as a 5-flight technology demonstrator, the 1.8 kg Ingenuity Mars Helicopter completed 72 autonomous flights before rotor blade damage in January 2024 retired it to stationary airfield operations.',
    instruments: ['Counter-Rotating 1.2m Carbon-Fiber Rotors', 'Downward Navigation Camera & Laser Altimeter', 'Solar Array & Li-Ion Battery'],
    constraint: 'Martian air has ~1% of Earth’s surface density; combined with a multi-minute radio delay, every flight had to be navigated onboard autonomously.',
    measurements: '72 total flights covering ~17.0 km ground distance and 128.8 total flight minutes; peak speed 10 m/s, peak altitude 24 m.',
    uncertaintyNote: 'Ingenuity carried no science payload of its own; its contribution was aerial scouting and proving powered extraterrestrial flight.',
    relatedIds: ['perseverance', 'near-shoemaker'],
    authenticCredit: 'NASA / JPL-Caltech — Ingenuity Mars Helicopter',
    authenticLabel: 'Official NASA mission record (Illustration shown in-game)',
  },
  'pioneer-10': {
    sprite: '/assets/generated/sprites/pioneer.png',
    decade: '1970s',
    memoryEcho:
      'Through the uncharted rubble of the asteroid belt and into Jupiter’s fierce radiation belts—bearing a small gold plaque toward Aldebaran.',
    archivistNote:
      'Launched in 1972, Pioneer 10 was the first spacecraft to traverse the asteroid belt, fly past Jupiter, and achieve solar-system escape velocity. Last weak signal was received in January 2003.',
    instruments: ['Helium Vector Magnetometer', 'Imaging Photopolarimeter', 'Geiger Tube Radiation Telescope', 'RTG Power Units'],
    constraint: 'Intense Jovian radiation belts nearly saturated electronics, informing heavy shielding designs for Voyager and Galileo.',
    measurements: 'Mapped Jupiter’s magnetosphere and confirmed spacecraft could survive transit through the main asteroid belt.',
    uncertaintyNote: 'No longer transmitting; exact current trajectory is calculated from last radio tracking data (~12+ billion km away).',
    relatedIds: ['pioneer-11', 'voyager-1'],
    authenticCredit: 'NASA Ames Research Center — Pioneer 10',
    authenticLabel: 'Official NASA mission record (Illustration shown in-game)',
  },
  'pioneer-11': {
    sprite: '/assets/generated/sprites/pioneer.png',
    decade: '1970s',
    memoryEcho:
      'A gravity swing past Jupiter hurled me across the gulf to Saturn, threading safely beneath its icy ring plane to prove the path for Voyager.',
    archivistNote:
      'Pioneer 11 made the first close reconnaissance of Saturn in September 1979, discovering Saturn’s F ring and testing the ring-plane crossing trajectory later used by Voyager.',
    instruments: ['Fluxgate & Helium Magnetometers', 'Imaging Photopolarimeter', 'Infrared Radiometer'],
    constraint: 'RTG electrical output fell below the level required to operate the transmitter by September 1995.',
    measurements: 'Identified Saturn’s F ring, measured Saturn’s magnetic field alignment, and charted Titan’s frigid atmosphere.',
    uncertaintyNote: 'Trajectory is known approximately from ballistic extrapolation; no telemetry since 1995.',
    relatedIds: ['pioneer-10', 'voyager-1', 'cassini-huygens'],
    authenticCredit: 'NASA Ames Research Center — Pioneer 11',
    authenticLabel: 'Official NASA mission record (Illustration shown in-game)',
  },
  'voyager-1': {
    sprite: '/assets/generated/sprites/voyager.png',
    decade: '1970s',
    memoryEcho:
      'Forty-nine years into the dark. My cameras went quiet decades ago to save warmth for the sensors that still taste the solar wind giving way to the stars.',
    archivistNote:
      'Launched in 1977, Voyager 1 explored Jupiter and Saturn before crossing the heliopause into interstellar space in 2012. Every year, engineers must turn off heaters or switch off subsystems as its plutonium-238 RTG power declines by ~4 W/year.',
    instruments: ['Cosmic Ray Subsystem (CRS)', 'Magnetometer (MAG)', 'Plasma Wave Subsystem (PWS)', 'Low-Energy Charged Particles (LECP)'],
    constraint: 'At >24 billion km, radio signals take over 22 hours one-way and arrive at Earth’s 70-meter DSN antennas at fractions of a quintillionth of a watt.',
    measurements: 'Confirmed heliopause crossing at ~121 AU via plasma density jump and interstellar cosmic-ray increase.',
    uncertaintyNote: 'Active operating-instrument and heater status changes regularly as engineers manage RTG power; recheck NASA Voyager status before release.',
    relatedIds: ['voyager-2', 'pioneer-10', 'new-horizons'],
    authenticCredit: 'NASA / JPL-Caltech — Voyager Interstellar Mission',
    authenticLabel: 'Official NASA mission record (Illustration shown in-game)',
  },
  'voyager-2': {
    sprite: '/assets/generated/sprites/voyager.png',
    decade: '1970s',
    memoryEcho:
      'Once every 176 years, four giant planets align. I rode the gravity slingshot past Jupiter, Saturn, Uranus, and Neptune—the only spacecraft to meet all four.',
    archivistNote:
      'Voyager 2 remains the only spacecraft ever to visit Uranus (1986) and Neptune (1989), entering interstellar space in 2018 via a southern trajectory.',
    instruments: ['Plasma Science (PLS)', 'Cosmic Ray & LECP Sensors', 'Magnetometer', 'Imaging Science Subsystem (turned off post-Neptune)'],
    constraint: 'Increasing distance required DSN arraying across continents and reduced data rates from 115.2 kbps at Jupiter down to ~160 bps.',
    measurements: 'Discovered active nitrogen geysers on Triton, tilted magnetic fields on Uranus and Neptune, and Neptune’s supersonic winds.',
    uncertaintyNote: 'Verify current active-instrument roster directly on NASA Voyager status pages prior to release.',
    relatedIds: ['voyager-1', 'cassini-huygens'],
    authenticCredit: 'NASA / JPL-Caltech — Voyager 2 Grand Tour',
    authenticLabel: 'Official NASA mission record (Illustration shown in-game)',
  },
  'galileo': {
    sprite: '/assets/generated/sprites/galileo.png',
    decade: '1980s',
    memoryEcho:
      'When my main umbrella dish jammed half-open, engineers rewrote my brain to whisper everything through a tiny backup antenna—and discovered salty oceans beneath Europa’s ice.',
    archivistNote:
      'Galileo released the first atmospheric probe into Jupiter in 1995 and orbited the Jovian system for eight years despite a stuck high-gain antenna, before intentionally plunging into Jupiter to protect Europa from contamination.',
    instruments: ['Solid State Imaging Camera', 'Near-Infrared Mapping Spectrometer', 'Magnetometer', 'Jovian Atmospheric Entry Probe'],
    constraint: 'Main high-gain dish failed to unfurl, forcing onboard data compression to transmit science at 10–160 bps via the low-gain antenna.',
    measurements: 'Magnetic induction signals indicated global subsurface liquid saltwater oceans inside Europa, Ganymede, and Callisto.',
    uncertaintyNote: 'Intentionally deorbited into Jupiter’s atmosphere in September 2003 for planetary protection.',
    relatedIds: ['voyager-1', 'cassini-huygens'],
    authenticCredit: 'NASA / JPL — Galileo Mission to Jupiter',
    authenticLabel: 'Official NASA mission record (Illustration shown in-game)',
  },
  'cassini-huygens': {
    sprite: '/assets/generated/sprites/cassini.png',
    decade: '1990s',
    memoryEcho:
      'Thirteen years dancing through Saturn’s rings, watching ice plumes erupt from Enceladus while ESA’s Huygens settled onto the methane riverbeds of Titan.',
    archivistNote:
      'A joint NASA/ESA/ASI flagship mission, Cassini orbited Saturn from 2004 to 2017 and delivered ESA’s Huygens lander onto Titan’s surface in 2005—the farthest landing ever achieved. Cassini ended with a planned plunge into Saturn.',
    instruments: ['Cassini Imaging (ISS) & VIMS', 'Ion and Neutral Mass Spectrometer (INMS)', 'ESA Huygens DISR & GCMS'],
    constraint: 'Low fuel reserves required a safe Grand Finale disposal inside Saturn to prevent contaminating Titan or Enceladus.',
    measurements: 'Sampled water vapor, salts, and organics in Enceladus plumes; Huygens returned 2.5 hours of surface/descent data on Titan.',
    uncertaintyNote: 'Credit ESA for the Huygens Titan lander and its surface observations; Cassini was NASA/JPL-operated.',
    relatedIds: ['pioneer-11', 'voyager-1', 'galileo'],
    authenticCredit: 'NASA / JPL / ESA / ASI — Cassini-Huygens Mission',
    authenticLabel: 'Official NASA/ESA mission record (Illustration shown in-game)',
  },
  'near-shoemaker': {
    sprite: '/assets/generated/sprites/near-shoemaker.png',
    decade: '1990s',
    memoryEcho:
      'I had no landing legs and no landing radar. Only four small hydrazine burns, a laser rangefinder, and engineers wondering if an orbiter could set itself down gently on a potato-shaped asteroid.',
    archivistNote:
      'NEAR Shoemaker became the first spacecraft to orbit and land on an asteroid (433 Eros) on February 12, 2001. Built strictly as an orbiter, its team used laser ranging and 4 controlled braking burns to touch down at ~1.5–1.8 m/s, continuing gamma-ray spectroscopy from the surface.',
    instruments: ['NEAR Laser Rangefinder (NLR)', 'Multispectral Imager (MSI)', 'X-Ray/Gamma-Ray Spectrometer (XGRS)'],
    constraint: 'Not designed as a lander; weak gravity (~1/1000 Earth g) meant touching down too fast could bounce the craft back into space.',
    measurements: 'Survived landing intact and collected 14 days of close-contact gamma-ray elemental data before hibernation.',
    uncertaintyNote: 'Craft survived upright on the tips of two solar wings and bottom bus; contact ended February 28, 2001.',
    relatedIds: ['surveyor-1', 'dawn', 'deep-impact-epoxi'],
    authenticCredit: 'NASA / Johns Hopkins APL — NEAR Shoemaker',
    authenticLabel: 'Official NASA mission record (Illustration shown in-game)',
  },
  'deep-impact-epoxi': {
    sprite: '/assets/generated/sprites/deep-impact.png',
    decade: '2000s',
    memoryEcho:
      'One copper projectile struck the comet’s sunlit crust while my flyby eyes stayed back 500 kilometers to watch ancient ice and dust erupt into view.',
    archivistNote:
      'Deep Impact released a 370 kg copper impactor into Comet Tempel 1 on July 4, 2005, exposing pristine subsurface comet material. The flyby craft continued as EPOXI to Comet Hartley 2 until contact was lost in 2013.',
    instruments: ['High Resolution Instrument (HRI) & IR Spectrometer', 'Medium Resolution Instrument', '370 kg Autonomous Impactor'],
    constraint: 'High closing velocity (10.2 km/s) gave the impactor’s autonomous optical tracker minutes to steer onto a bright target spot.',
    measurements: 'Revealed fluffy, porous surface layers with fine silicate dust, water ice, and organic carbon compounds inside Tempel 1.',
    uncertaintyNote: 'Contact with the flyby spacecraft ended in August 2013 due to a software clock rollover/attitude loss.',
    relatedIds: ['near-shoemaker', 'dawn'],
    authenticCredit: 'NASA / JPL / University of Maryland — Deep Impact',
    authenticLabel: 'Official NASA mission record (Illustration shown in-game)',
  },
  'dawn': {
    sprite: '/assets/generated/sprites/dawn.png',
    decade: '2000s',
    memoryEcho:
      'Blue xenon ions pushed me gently for years across the asteroid belt—first into orbit around rocky Vesta, then breaking free to circle icy dwarf planet Ceres.',
    archivistNote:
      'Using high-efficiency xenon ion propulsion, Dawn became the only spacecraft ever to enter orbit around two separate extraterrestrial bodies (Vesta in 2011 and Ceres in 2015), where it remains in a sterile quarantine orbit.',
    instruments: ['Xenon Ion Propulsion System (3 NSTAR thrusters)', 'Framing Camera', 'VIR Spectrometer & GRaND'],
    constraint: 'Hydrazine attitude-control fuel depletion ended pointing capability on November 1, 2018.',
    measurements: 'Revealed bright sodium carbonate salt deposits inside Ceres’s Occator Crater from briny subsurface cryovolcanism.',
    uncertaintyNote: 'Protected high orbit ensures Dawn will not impact Ceres for decades to preserve planetary protection.',
    relatedIds: ['near-shoemaker', 'deep-impact-epoxi'],
    authenticCredit: 'NASA / JPL / UCLA — Dawn Mission',
    authenticLabel: 'Official NASA mission record (Illustration shown in-game)',
  },
  'new-horizons': {
    sprite: '/assets/generated/sprites/new-horizons.png',
    decade: '2000s',
    memoryEcho:
      'Nine and a half years racing across three billion miles for one single day beside Pluto—every instrument firing in silence because Earth was 4.5 light-hours away.',
    archivistNote:
      'New Horizons flew past Pluto and Charon at 13.78 km/s on July 14, 2015, revealing nitrogen glaciers in Sputnik Planitia ("the heart"). Because of slow 1–2 kbps downlink from 5 billion km, transmitting the 6.25 GB of flyby data back to Earth took 15 months.',
    instruments: ['LORRI Long-Range Imager', 'Ralph Multispectral/IR Imager', 'Alice UV Spectrometer', 'REX Radio Science'],
    constraint: 'Could not stop to orbit; every measurement had to be preprogrammed into solid-state recorders during a few core flyby hours.',
    measurements: 'Measured Pluto radius (1,188 km), nitrogen/methane glacier convection, hazy layered atmosphere, and later imaged Arrokoth (2019).',
    uncertaintyNote: 'Pluto geology results (2015) are distinct from later Kuiper Belt object Arrokoth (2019) and ongoing outer heliosphere measurements.',
    relatedIds: ['voyager-1', 'voyager-2'],
    authenticCredit: 'NASA / Johns Hopkins APL / SwRI — New Horizons',
    authenticLabel: 'Official NASA mission record (Illustration shown in-game)',
  },
  'kepler': {
    sprite: '/assets/generated/sprites/kepler.png',
    decade: '2000s',
    memoryEcho:
      'Staring steadily at 150,000 suns, watching for the tiniest blink as distant worlds crossed their faces—until my fuel ran dry and I drifted quiet behind Earth.',
    archivistNote:
      'Launched in 2009, the Kepler Space Telescope stared at a single patch of the Milky Way to measure tiny dips in starlight caused by transiting exoplanets, revolutionizing astronomy before fuel depletion in October 2018.',
    instruments: ['0.95m Schmidt Photometer (42 CCDs)', 'Star Trackers & Reaction Wheels'],
    constraint: 'Reaction wheel failures ended primary field pointing in 2013, prompting the ingenious solar-pressure-balanced K2 extended mission.',
    measurements: 'Confirmed >2,600 exoplanets and proved statistically that planets outnumber stars in the Milky Way.',
    uncertaintyNote: 'Spacecraft was safely deactivated in a stable Earth-trailing heliocentric orbit and cannot return to collide with Earth.',
    relatedIds: ['voyager-1', 'new-horizons'],
    authenticCredit: 'NASA Ames Research Center — Kepler / K2',
    authenticLabel: 'Official NASA mission record (Illustration shown in-game)',
  },
};

export interface EncounterChoice {
  id: string;
  label: string;
  detail: string;
  isOptimal: boolean;
  feedback: string;
}

export interface EncounterConfig {
  id: string;
  missionId: string;
  hookQuestion: string;
  constraintSummary: string;
  instrumentName: string;
  mechanicLabel: string;
  prompt: string;
  choices: EncounterChoice[];
  evidenceResult: string;
  discoveryEnabled: string;
  nextMissionId: string;
  nextMissionName: string;
  assistHint: string;
}

export const ENCOUNTER_CONFIGS: Record<string, EncounterConfig> = {
  'gentle-touch': {
    id: 'gentle-touch',
    missionId: 'surveyor-1',
    hookQuestion: 'How do you land gently on a Moon you have never touched—when Earth radio takes 2.5 seconds to answer?',
    constraintSummary: 'Autonomous RADVS radar altimeter & Doppler velocity sensor control three vernier thrusters; zero real-time joystick control.',
    instrumentName: 'RADVS Radar Altimeter & 3 Vernier Thrusters',
    mechanicLabel: 'Navigate & Manage · Automated Descent Sequencing',
    prompt: 'Select the autonomous RADVS + vernier thruster profile to touch down softly at Oceanus Procellarum (< 6.0 m/s):',
    choices: [
      {
        id: 'opt-manual',
        label: 'A) Wait for Earth ground-control joystick commands at 500 m',
        detail: 'Relay altitude via radio and wait 2.5s for manual throttle commands.',
        isOptimal: false,
        feedback: 'Soft Failure: At 130 m/s approach speed, a 2.5-second round-trip radio delay causes a high-velocity impact before Earth commands arrive.',
      },
      {
        id: 'opt-auto',
        label: 'B) Engage Main Retro at 75 km → Eject Casing → Vernier Cutoff at 3.4 m',
        detail: 'Let onboard radar lock velocity down to 1.5 m/s and shut off verniers at 3.4 m so exhaust will not kick up blinding dust.',
        isOptimal: true,
        feedback: 'Signal Lock! Main retro absorbed 97% of orbital speed; vernier engines throttled smoothly via RADVS radar, setting footpads down at ~3.4 m/s.',
      },
      {
        id: 'opt-blast',
        label: 'C) Keep Vernier Engines firing all the way until ground contact',
        detail: 'Maintain continuous thrust straight into the lunar regolith.',
        isOptimal: false,
        feedback: 'Soft Failure: Firing thrusters right down to the dust blasts regolith particles into the camera lens and risks tipping the tripod lander.',
      },
    ],
    evidenceResult: 'Footpad strain gauges recorded solid lunar bearing strength; television camera returned 11,237 high-resolution images.',
    discoveryEnabled: 'Proved the lunar regolith could support heavy Apollo Lunar Modules without sinking.',
    nextMissionId: 'apollo-11-surface',
    nextMissionName: 'Apollo 11 Surface Hardware',
    assistHint: 'Junior Guidance: Look for the choice that uses onboard autonomous radar AND cuts engines just above the dust (3.4 m) to protect the cameras.',
  },
  'echo-never-sleeps': {
    id: 'echo-never-sleeps',
    missionId: 'apollo-11-surface',
    hookQuestion: 'Can an unpowered box left on the Moon in 1969 still answer Earth observatories today?',
    constraintSummary: 'Passive fused-silica corner cubes need zero electricity, but out of 10^17 laser photons fired, only a few return amidst background moonlight.',
    instrumentName: '100-Corner-Cube Retroreflector Array (LRRR)',
    mechanicLabel: 'Observe & Infer · Photon Coincidence & Ranging',
    prompt: 'Observe the observatory return histogram (t = 2.564 s round-trip peak) and infer how the array responds:',
    choices: [
      {
        id: 'opt-radio',
        label: 'A) Wait for the array’s internal nuclear battery to broadcast a radio beacon',
        detail: 'Tune Deep Space Network S-band receivers to Mare Tranquillitatis.',
        isOptimal: false,
        feedback: 'Soft Failure: Accuracy Check! The Apollo 11 LRRR is completely passive—it has no battery, no electronics, and transmits zero radio signals.',
      },
      {
        id: 'opt-laser',
        label: 'B) Fire short green laser pulses → Filter single-photon timing spike (2.564 s) → Infer d = c·t/2',
        detail: 'Use narrow spectral/time gating to isolate returning photons bounced straight back by the corner cubes.',
        isOptimal: true,
        feedback: 'Signal Lock! Corner cubes reflect light parallel to the incoming beam. Round-trip time t = 2.564 s yields Earth–Moon distance (~384,400 km) to millimeter precision!',
      },
      {
        id: 'opt-mirror',
        label: 'C) Aim a continuous spotlight and track steady brightness over one hour',
        detail: 'Measure average reflected brightness rather than pulsed flight time.',
        isOptimal: false,
        feedback: 'Soft Failure: Steady sunlight reflects far brighter off the surrounding lunar dust than from a 46 cm reflector. Pulsed picosecond timing is essential.',
      },
    ],
    evidenceResult: 'Repeated round-trip laser timings revealed the Moon spirals away from Earth at 3.8 cm per year and tests general relativity.',
    discoveryEnabled: 'Demonstrated how passive optical infrastructure outlives powered electronics by decades.',
    nextMissionId: 'apollo-17-surface',
    nextMissionName: 'Apollo 17 Surface Hardware',
    assistHint: 'Junior Guidance: Choose the option that uses pulsed laser light and divides round-trip light travel time (c × t / 2).',
  },
  'farther-than-footsteps': {
    id: 'farther-than-footsteps',
    missionId: 'apollo-17-surface',
    hookQuestion: 'How far can explorers drive away from their lander when their oxygen and walk-back safety limit is ticking?',
    constraintSummary: 'You must maximize geological diversity (mare basalt, highland breccia, orange glass) while keeping battery and time inside the safe return envelope.',
    instrumentName: 'Lunar Roving Vehicle (LRV-3) & Geological Traverse',
    mechanicLabel: 'Navigate & Manage · Route & Walk-Back Constraints',
    prompt: 'Select the Taurus–Littrow EVA-2 traverse plan that gathers diverse geology without exceeding the safe walk-back perimeter:',
    choices: [
      {
        id: 'opt-far',
        label: 'A) Drive 18 km straight outward past North Massif until battery hits 5%',
        detail: 'Maximize single-direction distance regardless of walk-back distance.',
        isOptimal: false,
        feedback: 'Soft Failure: Violation of NASA’s Walk-Back Constraint! If the rover failed 18 km away, crew oxygen would not last the walk back to the Lunar Module.',
      },
      {
        id: 'opt-loop',
        label: 'B) Execute 3-station South Massif → Shorty Crater loop (7.6 km radius, 48% battery reserve)',
        detail: 'Sample landslide highland rocks at South Massif and investigate orange volcanic glass at Shorty within safe walk-back margin.',
        isOptimal: true,
        feedback: 'Signal Lock! Balanced loop stayed safely inside the walk-back perimeter while uncovering 3.64-billion-year-old orange pyroclastic glass at Shorty Crater.',
      },
      {
        id: 'opt-stay',
        label: 'C) Remain within 200 m of the Lunar Module collecting only local mare rocks',
        detail: 'Avoid all rover risk and stay on foot near the landing pad.',
        isOptimal: false,
        feedback: 'Soft Failure: While safe, staying next to the LM misses the highland massif boulders and Shorty Crater’s unique volcanic mantle glass.',
      },
    ],
    evidenceResult: 'Sampled 110.5 kg across 35.9 km total driving, proving deep volcanic fire-fountaining once occurred on the Moon.',
    discoveryEnabled: 'Established robotic and crewed rover traverse planning protocols still used by Mars rovers.',
    nextMissionId: 'viking-1',
    nextMissionName: 'Viking 1',
    assistHint: 'Junior Guidance: Pick the balanced loop route that captures multiple rock types (South Massif + Shorty Crater) while preserving a walk-back reserve.',
  },
  'question-in-the-soil': {
    id: 'question-in-the-soil',
    missionId: 'viking-1',
    hookQuestion: 'One test released radioactive gas as if microbes breathed. Another test found zero organic molecules. Which conclusion does the evidence actually support?',
    constraintSummary: 'Soil heated in the Labeled Release chamber evolved 14CO2 gas, yet the GCMS detected no organic carbon compounds above parts-per-billion limits.',
    instrumentName: 'Viking Biology Laboratory & GCMS',
    mechanicLabel: 'Observe & Infer · Scientific Caution & Ambiguity',
    prompt: 'Compare the Biology LR readout and the GCMS chemistry readout, then select the conclusion justified by the combined evidence:',
    choices: [
      {
        id: 'opt-alive',
        label: 'A) Conclude Viking 1 definitively discovered living Martian microbes',
        detail: 'Accept the Labeled Release gas pulse alone and ignore the GCMS.',
        isOptimal: false,
        feedback: 'Soft Failure: Scientific Integrity Check! Without organic carbon found by the GCMS, a non-biological oxidant in the soil could explain the gas pulse.',
      },
      {
        id: 'opt-qualified',
        label: 'B) Record an ambiguous, chemically reactive result—neither proving nor ruling out all Martian life',
        detail: 'Report both the active gas release and the absence of detected organics, noting reactive soil chemistry (later linked to perchlorates) could mimic biology.',
        isOptimal: true,
        feedback: 'Signal Lock! That cautious, evidence-grounded conclusion shaped the next 50 years of astrobiology: "Follow the water, search for organics, and understand surface chemistry."',
      },
      {
        id: 'opt-dead',
        label: 'C) Conclude Mars is completely sterile across the entire planet forever',
        detail: 'Assume two shallow topsoil scoops represent every layer of Mars.',
        isOptimal: false,
        feedback: 'Soft Failure: Absence of confirmation in two surface samples does not disprove subsurface or ancient habitability elsewhere on Mars.',
      },
    ],
    evidenceResult: 'Combined LR + GCMS data demonstrated that extraordinary biological claims require multi-instrument corroboration.',
    discoveryEnabled: 'Led directly to Phoenix and Curiosity investigating perchlorates, ancient lakes, and complex organic preservation.',
    nextMissionId: 'spirit',
    nextMissionName: 'Spirit',
    assistHint: 'Junior Guidance: Good science respects conflicting data—choose the honest, qualified interpretation that avoids overclaiming.',
  },
  'clues-beneath-the-wheel': {
    id: 'clues-beneath-the-wheel',
    missionId: 'spirit',
    hookQuestion: 'When a rover’s front wheel locks up in red dust, how can a setback become one of Mars’s biggest clues about ancient water?',
    constraintSummary: 'Spirit could only drag its dead right-front wheel backward near Home Plate, turning the stuck wheel into an accidental geological trenching plow.',
    instrumentName: 'Mini-TES Spectrometer & APXS (with Dragged Wheel)',
    mechanicLabel: 'Navigate & Observe · Accident to Discovery',
    prompt: 'Direct Spirit near Home Plate, inspect the bright soil uncovered in the wheel trench, and identify the mineral signature:',
    choices: [
      {
        id: 'opt-salt',
        label: 'A) Ignore the pale trench and classify it as common Martian windblown dust',
        detail: 'Drive around the bright streak without turning the spectrometer arm.',
        isOptimal: false,
        feedback: 'Soft Failure: Windblown Martian dust is iron-rich rust orange—bright white material exposed underneath is a major geological anomaly!',
      },
      {
        id: 'opt-silica',
        label: 'B) Pivot backward to aim Mini-TES/APXS → Confirm ~90% amorphous silica formed by ancient hydrothermal water',
        detail: 'Compare thermal infrared & elemental spectra showing pure silica typical of volcanic hot springs or acid steam.',
        isOptimal: true,
        feedback: 'Signal Lock! Mini-TES and APXS revealed >90% pure silica—evidence that Gusev Crater once hosted hot springs or steam vents capable of sustaining microbial habitats.',
      },
      {
        id: 'opt-ice',
        label: 'C) Identify the streak as fresh surface snow in equatorial Gusev Crater',
        detail: 'Conclude liquid snow sits stably on equatorial daytime rocks.',
        isOptimal: false,
        feedback: 'Soft Failure: Equatorial daytime temperatures and low Martian pressure prevent pure snow/ice from sitting exposed at Home Plate. Spectra match silica.',
      },
    ],
    evidenceResult: 'Confirmed localized ancient hydrothermal activity at Home Plate using combined APXS chemistry and Mini-TES spectra.',
    discoveryEnabled: 'Showed later missions like Perseverance where biosignatures could be entombed in hot-spring silica deposits.',
    nextMissionId: 'ingenuity',
    nextMissionName: 'Ingenuity',
    assistHint: 'Junior Guidance: Turn the rover’s instruments onto the bright white wheel trench to detect hydrothermal silica.',
  },
  'air-thin-as-a-whisper': {
    id: 'air-thin-as-a-whisper',
    missionId: 'ingenuity',
    hookQuestion: 'Martian air has only 1% the density of Earth’s atmosphere. How can a 1.8 kg helicopter lift off on its own?',
    constraintSummary: 'Extreme thinness demands massive rotor RPM, lightweight carbon blades, overnight battery heating, and onboard autonomous navigation.',
    instrumentName: '1.2m Counter-Rotating Rotors & Autonomous Navcam',
    mechanicLabel: 'Navigate & Manage · Thin-Atmosphere Flight Parameters',
    prompt: 'Configure Ingenuity’s parameters before sending the autonomous flight sequence to Jezero Crater:',
    choices: [
      {
        id: 'opt-earth',
        label: 'A) Use standard Earth drone speed (400 RPM) and remote-control via live Earth joystick',
        detail: 'Keep rotor power low to save battery and pilot live from JPL.',
        isOptimal: false,
        feedback: 'Soft Failure: At 400 RPM in 1% atmospheric density, blades generate almost zero lift—and 10+ minute radio delay makes live joystick piloting impossible.',
      },
      {
        id: 'opt-2537',
        label: 'B) Reserve heater battery overnight → Spin carbon rotors at 2,537 RPM → Autonomous 5m Navcam hover',
        detail: 'Balance thermal survival energy with high-RPM lift and downward visual odometry.',
        isOptimal: true,
        feedback: 'Signal Lock! Rotors sliced the thin air at 2,537 RPM (~5× faster than Earth helicopters), executing the Wright Brothers moment on Mars and starting 72 historic flights!',
      },
      {
        id: 'opt-cargo',
        label: 'C) Load 10 kg of rock tubes onto the skids and fly 100 meters high immediately',
        detail: 'Test maximum cargo transport capacity on Flight 1.',
        isOptimal: false,
        feedback: 'Soft Failure: Accuracy Guardrail! Ingenuity weighed just 1.8 kg and carried zero science cargo—overloading or high-altitude hops exceed rotor thrust limits.',
      },
    ],
    evidenceResult: 'Executed 72 autonomous flights (~17 km total), scouting hazards ahead of Perseverance across Jezero Crater.',
    discoveryEnabled: 'Unlocked aerial planetary exploration concepts for future Mars rotorcraft and Titan’s Dragonfly.',
    nextMissionId: 'near-shoemaker',
    nextMissionName: 'NEAR Shoemaker',
    assistHint: 'Junior Guidance: Thin Martian air requires ultra-fast rotors (~2,537 RPM), overnight battery heating, and autonomous visual navigation.',
  },
  'landing-not-planned': {
    id: 'landing-not-planned',
    missionId: 'near-shoemaker',
    hookQuestion: 'How do you land a spacecraft on a tumbling asteroid when the spacecraft was never built with landing legs?',
    constraintSummary: '433 Eros has ~1/1000 Earth gravity and an uneven peanut shape; NEAR had only orbital thrusters and a laser rangefinder (NLR).',
    instrumentName: 'NEAR Laser Rangefinder (NLR) & XGRS Spectrometer',
    mechanicLabel: 'Observe & Navigate · Unplanned Asteroid Descent',
    prompt: 'Use orbital NLR shape data to execute NEAR Shoemaker’s controlled descent onto 433 Eros:',
    choices: [
      {
        id: 'opt-chute',
        label: 'A) Deploy supersonic parachutes to brake through Eros’s atmosphere',
        detail: 'Rely on aerodynamic drag to slow the descent.',
        isOptimal: false,
        feedback: 'Soft Failure: Asteroid 433 Eros is an airless rocky body in vacuum—parachutes do nothing without an atmosphere.',
      },
      {
        id: 'opt-edb',
        label: 'B) Map gravity/shape with NLR → Fire 4 timed hydrazine braking burns → Touch down < 1.8 m/s',
        detail: 'Step velocity down cleanly onto flat Himeros regolith while taking close-up MSI images down to 120 m.',
        isOptimal: true,
        feedback: 'Signal Lock! Four precision End-of-Mission Descent Burns (EDB 1–4) set NEAR gently onto Eros at ~1.5–1.8 m/s. Its gamma-ray spectrometer operated from the surface for two more weeks!',
      },
      {
        id: 'opt-fast',
        label: 'C) Drop straight down at 25 m/s without braking burns',
        detail: 'Let Eros’s weak gravity handle the impact.',
        isOptimal: false,
        feedback: 'Soft Failure: Even in weak gravity, striking rocky regolith at 25 m/s shatters the solar wings and ends surface telemetry.',
      },
    ],
    evidenceResult: 'First spacecraft to orbit and soft-land on an asteroid, measuring surface elemental abundances via direct-contact gamma-ray spectroscopy.',
    discoveryEnabled: 'Pioneered proximity navigation techniques later applied by OSIRIS-REx and DART.',
    nextMissionId: 'voyager-1',
    nextMissionName: 'Voyager 1',
    assistHint: 'Junior Guidance: Eros has no air—use orbital laser mapping and the 4 gentle hydrazine braking burns.',
  },
  'power-for-the-unknown': {
    id: 'power-for-the-unknown',
    missionId: 'voyager-1',
    hookQuestion: 'At 24 billion kilometers from the Sun, your plutonium power drops every year. What do you turn off to keep talking to Earth?',
    constraintSummary: 'RTG electrical output falls ~4 W per year. Turning off heaters risks freezing fuel lines or instruments, while keeping planetary cameras wastes precious watts.',
    instrumentName: 'RTG Power Bus, CRS/MAG/PWS Interstellar Suite & DSN 70m Antenna',
    mechanicLabel: 'Communicate & Preserve · Interstellar Power Budgeting',
    prompt: 'Allocate Voyager 1’s declining 220 W power budget to preserve interstellar particle science and Deep Space Network downlink:',
    choices: [
      {
        id: 'opt-cam',
        label: 'A) Power on the wide-angle optical cameras and scan platform heaters',
        detail: 'Try to photograph deep space darkness at high power draw.',
        isOptimal: false,
        feedback: 'Soft Failure: Cameras were powered off decades ago after the Pale Blue Dot portrait—leaving them on drains power needed to heat propellant lines and run particle sensors.',
      },
      {
        id: 'opt-interstellar',
        label: 'B) Keep cameras off → Prioritize essential thruster heaters + CRS/MAG/PWS sensors + 160 bps DSN downlink',
        detail: 'Preserve fields-and-particles instruments measuring cosmic rays and magnetic fields beyond the heliopause.',
        isOptimal: true,
        feedback: 'Signal Lock! Careful power shedding lets Voyager 1 survive beyond the heliopause, whispering interstellar plasma and cosmic-ray readings across 22+ light-hours to Earth’s 70 m DSN dishes.',
      },
      {
        id: 'opt-off',
        label: 'C) Shut down the radio transmitter to save maximum power',
        detail: 'Record interstellar data permanently without sending it home.',
        isOptimal: false,
        feedback: 'Soft Failure: Without the S/X-band radio transmitter, Earth’s Deep Space Network receives zero measurements.',
      },
    ],
    evidenceResult: 'Continuous fields-and-particles data confirmed Voyager 1 crossed the heliopause into the interstellar medium.',
    discoveryEnabled: 'Demonstrates how long-horizon spacecraft adapt mission goals from imaging to particle physics.',
    nextMissionId: 'new-horizons',
    nextMissionName: 'New Horizons',
    assistHint: 'Junior Guidance: Choose the budget that keeps planetary cameras off while protecting fields/particles instruments and radio downlink.',
  },
  'one-chance-at-pluto': {
    id: 'one-chance-at-pluto',
    missionId: 'new-horizons',
    hookQuestion: 'You race past Pluto at 14 kilometers per second—and Earth is 4.5 light-hours away. How do you capture a whole world in a few hours?',
    constraintSummary: 'Too fast to brake into orbit; onboard solid-state recorders can store only finite gigabytes, and post-flyby downlink at 1–2 kbps takes 15 months.',
    instrumentName: 'LORRI, Ralph, Alice, REX & Solid-State Recorder',
    mechanicLabel: 'Communicate & Preserve · Fast Flyby Observation Scheduling',
    prompt: 'Schedule New Horizons’ closest-approach sequence at Pluto under pointing, storage, and downlink constraints:',
    choices: [
      {
        id: 'opt-live',
        label: 'A) Stream uncompressed live 4K video straight to Earth during closest approach',
        detail: 'Skip onboard solid-state storage and transmit while flying past.',
        isOptimal: false,
        feedback: 'Soft Failure: At 5 billion km, radio bandwidth is only ~1–2 kbps! Attempting live video wastes pointing time and captures almost nothing.',
      },
      {
        id: 'opt-burst',
        label: 'B) Preprogram autonomous LORRI/Ralph/Alice burst into Solid-State Recorder → Turn dish toward Earth afterward for 15-month playback',
        detail: 'Dedicate closest approach strictly to observation pointing, then slowly downlink prioritized datasets over the next year.',
        isOptimal: true,
        feedback: 'Signal Lock! By storing every precious image and spectrum during the rapid Pluto/Charon pass and transmitting afterward, New Horizons revealed Sputnik Planitia’s flowing nitrogen glaciers!',
      },
      {
        id: 'opt-orbit',
        label: 'C) Fire retro-rockets to slow down and enter orbit around Pluto',
        detail: 'Stay permanently above Tombaugh Regio.',
        isOptimal: false,
        feedback: 'Soft Failure: At 13.78 km/s, entering orbit at Pluto would have required more fuel than the entire Atlas V rocket carried at launch!',
      },
    ],
    evidenceResult: 'Captured 6.25 GB of Pluto/Charon science and transmitted it home over 15 months, revealing active surface geology on a tiny icy world.',
    discoveryEnabled: 'Carried forward into the 2019 Arrokoth Kuiper Belt flyby and distant heliospheric studies.',
    nextMissionId: 'surveyor-1',
    nextMissionName: 'Surveyor 1 (Full Loop Complete)',
    assistHint: 'Junior Guidance: Dedicate closest approach to autonomous onboard recording, then downlink the stored data slowly afterward.',
  },
};
