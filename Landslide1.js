var imageCollection = ee.ImageCollection("COPERNICUS/S1_GRD"),
    table = ee.FeatureCollection("FAO/GAUL/2015/level2"),
    imageCollection3 = ee.ImageCollection("MODIS/061/MCD64A1"),
    imageCollection2 = ee.ImageCollection("FIRMS"),
    imageCollection4 = ee.ImageCollection("JRC/GHSL/P2023A/GHS_POP"),
    imageCollection6 = ee.ImageCollection("LANDSAT/LC08/C02/T1_L2");

//LANDSLIDE DETECTION LAYER AND MASKED LAYER Create a UI panel
var panel = ui.Panel({style: {width: '400px'}});
var mapPanel = ui.Map();

// Create a label
var titleLabel = ui.Label('Landslide Detection Visualization Tool');
panel.add(titleLabel);

// Add panel and map to the interface
ui.root.clear();
ui.root.add(panel);
ui.root.add(mapPanel);

// Set the center of the landslide area
var center = {lon: 136.89961, lat: 37.39405, zoom: 10};

// Create a circular buffer around the center
var bufferRadius = 10000; // in meters
var aoi = ee.Geometry.Point(center.lon, center.lat).buffer(bufferRadius); 

// Load Sentinel-1 GRD imagery
var sentinel1 = ee.ImageCollection('COPERNICUS/S1_GRD')
                  .filterBounds(aoi)
                  .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
                  .filter(ee.Filter.eq('orbitProperties_pass', 'DESCENDING'));

// Define the shock date
var shockDate = ee.Date('2024-01-01');

// Define the pre-event and post-event time intervals
var preInterval = 3; // Months before the shock date
var postInterval = 3; // Months after the shock date

// Filter the image collection to the pre-event period
var pre = sentinel1.filterDate(shockDate.advance(-preInterval, 'month'), shockDate);

// Filter the image collection to the post-event period
var post = sentinel1.filterDate(shockDate, shockDate.advance(postInterval, 'month'));

// Calculate mean difference between pre and post-event periods
var meanDiff = post.median().subtract(pre.median());

// Apply threshold to the difference image to create a mask
var mask = meanDiff.abs().gt(1); // Adjust the threshold as needed

// Create a masked layer to show the difference more clearly
var maskedDiff = meanDiff.updateMask(mask);

// Define visualization parameters for the original landslide detection layer
var visParamsOriginal = {
  bands: ['VV'],
  min: -3,
  max: 3,
  palette: ['blue', 'white', 'red']
};

// Define visualization parameters for the masked layer
var visParamsMasked = {
  bands: ['VV'],
  min: -3,
  max: 3,
  palette: ['blue', 'white', 'red'],
  opacity: 0.5 // Adjust the opacity of the masked layer as needed
};

// Add original landslide detection layer to the map
mapPanel.addLayer(meanDiff.clip(aoi), visParamsOriginal, 'Landslide Detection');

// Add masked landslide detection layer to the map
mapPanel.addLayer(maskedDiff.clip(aoi), visParamsMasked, 'Masked Landslide Detection');

// Set the map center and zoom level
mapPanel.setCenter(center.lon, center.lat, center.zoom);

// EDITS tbm: Building footprint
// Multipoint code to clip anaysis to land?
// NDVI/NIR?
// Set threshold to improve on the display
