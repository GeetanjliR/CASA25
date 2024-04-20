var imageCollection = ee.ImageCollection("COPERNICUS/S1_GRD"),
    imageCollection2 = ee.ImageCollection("MODIS/061/MCD64A1"),
    imageCollection3 = ee.ImageCollection("ESA/CCI/FireCCI/5_1"),
    imageCollection4 = ee.ImageCollection("COPERNICUS/S1_GRD"),
    table = ee.FeatureCollection("FAO/GAUL/2015/level2"),
    imageCollection5 = ee.ImageCollection("MODIS/061/MCD64A1"),
    imageCollection6 = ee.ImageCollection("FIRMS"),
    imageCollection7 = ee.ImageCollection("JRC/GHSL/P2023A/GHS_POP"),
    imageCollection8 = ee.ImageCollection("LANDSAT/LC08/C02/T1_L2"),
    image = ee.Image("USGS/SRTMGL1_003"),
    geometry = 
    /* color: #23cba7 */
    /* shown: false */
    ee.Geometry.MultiPoint();
    
    
    
/// ------------------------------------- SETTING ------------------------------------- ///
// Set an area of interest
var aoi = ee.Geometry.Polygon(
  [[
    [136.6996, 36.2903],
    [137.0996, 36.2903],
    [137.0996, 37.4903],
  ]]
);
var initialPoint = ee.Geometry.Point(136.89961, 37.39405);

// Creae a switching button
var layerSelect = ui.Select({
  items: ['DAMAGED BUILDING', 'LANDSLIDE', 'FIRE', 'TSUNAMI(AREA)', 'TSUNAMI(BUILDING)' ],
  value: 'DAMAGED BUILDING', //initial setting
  onChange: updateLayer, // 
  style: { stretch: 'horizontal', position: 'bottom-right' }
});

// Set a button panel
var buttonPanel = ui.Panel({
　widgets: [layerSelect],
  style: { position: 'bottom-right' }
});




/// ------------------------------------- DAMAGED BUILDING ------------------------------------- ///
// Set functions //
// Define a t-test function
function ttest(s1, shock, pre_interval, post_interval) {
  
  // Convert the shock date to a date object
  var shock = ee.Date(shock);
  // Filter the image collection to the pre-event period
  var pre = s1.filterDate(
    shock.advance(ee.Number(pre_interval).multiply(-1), "month"),
    shock
  );
  // Filter the image collection to the post-event period
  var post = s1.filterDate(shock, shock.advance(post_interval, "month"));
  
  // Calculate the mean, standard deviation, and number of images for the pre-event period
  var pre_mean = pre.mean();
  var pre_sd = pre.reduce(ee.Reducer.stdDev());
  var pre_n = ee.Number(pre.aggregate_array('orbitNumber_start').distinct().size());
  
  // Calculate the mean, standard deviation, and number of images for the pre-event period
  var post_mean = post.mean();
  var post_sd = post.reduce(ee.Reducer.stdDev());
  var post_n = ee.Number(post.aggregate_array('orbitNumber_start').distinct().size());
  
  // Calculate the pooled standard deviation
  var pooled_sd = pre_sd
    .multiply(pre_sd)
    .multiply(pre_n.subtract(1))
    .add(post_sd.multiply(post_sd).multiply(post_n.subtract(1)))
    .divide(pre_n.add(post_n).subtract(2))
    .sqrt();

    // Calculate the denominator of the t-test
  var denom = pooled_sd.multiply(
    ee.Number(1).divide(pre_n).add(ee.Number(1).divide(post_n)).sqrt()
  );

    // Calculate the Degrees of Freedom, which is the number of observations minus 2
  var df = pre_n.add(post_n).subtract(2);

  
  var change = post_mean
    .subtract(pre_mean)
    .divide(denom)
    .abs() //returning abs, so as t-value is bigger, the change becomes bigger.
    //.subtract(2);

    // return the t-values for each pixel
    return change
}

// Define a satelite image after t-test
function filter_s1(path) {

  // Filter the image collection to the ascending or descending orbit
  var orbits = ee
    .ImageCollection("COPERNICUS/S1_GRD_FLOAT")
    .filter(ee.Filter.listContains("transmitterReceiverPolarisation", "VH"))
    .filter(ee.Filter.eq("instrumentMode", "IW"))
    .filter(ee.Filter.eq("orbitProperties_pass", path))
    .filterBounds(aoi)
    .filterDate('2023-01-01','2024-04-15')
    .aggregate_array('relativeOrbitNumber_start')
    .distinct()
  
  print(orbits)
  
  var image_col=ee.ImageCollection(orbits.map(function(orbit){

  var s1 = ee
    .ImageCollection("COPERNICUS/S1_GRD_FLOAT")
    .filter(ee.Filter.listContains("transmitterReceiverPolarisation", "VH"))
    .filter(ee.Filter.eq("instrumentMode", "IW"))
    .filter(ee.Filter.eq("relativeOrbitNumber_start",orbit))
  
  
  // Calculate the t-test for the filtered image collection using the function we defined earlier
  var vv = ttest(s1.select("VV"), "2024-01-01", 12, 4)
  var vh = ttest(s1.select("VH"), '2024-01-01', 12, 4)
  var vv= vv.rename('change');
  var vh= vh.rename('change');
  
    // Return the t-values for each pixel
  var image=ee.ImageCollection([vv,vh]).mean()

  return image
  })).mean()
  
  return image_col
    
  }



// Set a dates //
var start = "2023-01-01";
var now = Date.now();
//var now='2024-03-31'
var end = ee.Date(now).format();



// Set an interface //

// Create a Draw a Polygon botton
var drawButton = ui.Button({
  label: "🔺" + " Draw a Polygon",
  onClick: drawPolygon,
  style: { stretch: "horizontal" },
});

// Create a Damage Assesment panel
var footagePanel = ui.Panel({
  widgets: [
    ui.Label("Damage Assessment", {
      fontWeight: "bold",
      fontSize: "20px",
    }),
    ui.Label(
      "Click the button below and draw a box on the map to get an estimate of the number of damaged buildings in a given area",
      { whiteSpace: "wrap" }
    ),
    
    drawButton,
    ui.Label(),
  ],
  style: { position: "top-left", maxWidth: "350px", maxHeight:'90%'},
  layout: ui.Panel.Layout.flow("vertical", true),
});


// Define a color scale function
function makeColorBarParams(palette) {
  return {
    bbox: [0, 0, 1, 0.1],
    dimensions: "100x10",
    format: "png",
    min: 0,
    max: 1,
    palette: palette.reverse(),
  };
}
var reds = ["yellow", "red", "purple"];

// Create the color bar
var colorBar = ui.Thumbnail({
  image: ee.Image.pixelLonLat().select(0),
  params: makeColorBarParams(reds.reverse()),
  style: { stretch: "horizontal", margin: "0px 8px", maxHeight: "24px" },
});

// Create the title for the color bar
var legendTitle = ui.Label({
  value: "Estimated Damage (t-value)",
  style: { fontWeight: "bold" ,textAlign: "center",stretch: "horizontal"},
});

// Create the panel for the color bar
var legendLabels = ui.Panel({
  widgets: [
    ui.Label('Low', { margin: "4px 8px" }),
    ui.Label( " ", {
      margin: "4px 8px",
      textAlign: "center",
      stretch: "horizontal",
    }),
    ui.Label('High', { margin: "4px 8px" }),
    ],
  layout: ui.Panel.Layout.flow("horizontal"),
});

// Create the scale
var scalePanel = ui.Panel({
  widgets: [
    ui.Label('2.5', { margin: "4px 8px" }), 
    ui.Label( " ", {
      margin: "4px 8px",
      textAlign: "center",
      stretch: "horizontal",
    }),
    ui.Label('6.0', { margin: "4px 8px" }), 
  ],
  layout: ui.Panel.Layout.flow("horizontal"),
});

// Set the panel 
var legendPanel = ui.Panel({
  widgets: [legendTitle, scalePanel, colorBar, legendLabels],
  style: { position: "bottom-left", Width: "350px"},
});



// Apply for a Japan case //
// Create mapPanel_building
var mapPanel_building = ui.Map();
mapPanel_building.setOptions('SATELLITE');

// Show mapPanel_building
ui.root.widgets().set(0, mapPanel_building);


// Define a function for returning an image of damaged buildings
function footprints(cutoff, aoi, label) {
  var footprints = ee.FeatureCollection('projects/ee-rengeanzu/assets/location-points-to-polygonss')
    .filterBounds(aoi)
    .map(function(feat) {
      return feat.set('area', feat.geometry().area(10)).set('geometry_type', feat.geometry().type());
    })
    .filter(ee.Filter.gt('area', 50));　//remove under 50 m2 buildings

  var mean = image.reduceRegions({
    collection: footprints,
    reducer: ee.Reducer.mean(),
    scale: 10
  });
  var damaged = mean.filter(ee.Filter.gt('mean', cutoff))

  print(damaged.size())
  
  var totalCount = mean.size()
  var damagedCount = damaged.size()
  var proportion = ((damagedCount.divide(totalCount)).multiply(100)).int() // .evaluate(function(val){return val});


  var outlines = ui.Map.Layer(damaged, {
    color: 'red'
  }, 'footprints');

  mapPanel_building.layers().set(0, outlines)
  mapPanel_building.layers().get(0).setShown(true)
  mapPanel_building.layers().get(1).setShown(false)
}


// Define "change" layer
function clear() {
  // Define a clear map
  mapPanel_building.clear()

  mapPanel_building.setOptions('SATELLITE')
  mapPanel_building.setControlVisibility({
    all: false
  });
  mapPanel_building.setControlVisibility({
    layerList: true,
    mapTypeControl: true
  }); 

  var urban = ee.ImageCollection('GOOGLE/DYNAMICWORLD/V1').filterDate('2023-01-01', '2024-04-15').mean().select('built')

  var boxcar = ee.Kernel.gaussian({
    radius: 50,
    units: 'meters',
    normalize: true,
    sigma: 20
  });

  // Call the filter_s1 function once for each orbit, and then combine the two images into a single image
  var asc = filter_s1("ASCENDING")
  var desc = filter_s1("DESCENDING")

  var image = ee
    .ImageCollection([asc, desc]).mean().convolve(boxcar)
    .updateMask(urban.gt(0.3))

  // Add the composite to the map
  var reds = ["yellow", "red", "purple"];

  // Add the composite to the map
  var damage_layer = ui.Map.Layer(
    image.updateMask(image.gt(2.5)), {
      min: 2.5,
      max: 6,
      opacity: 0.8,
      palette: reds
    },
    "change"
  );

  mapPanel_building.layers().set(0, damage_layer)
  mapPanel_building.style().set("cursor", "crosshair");
  mapPanel_building.centerObject(initialPoint, 14);
  mapPanel_building.add(legendPanel);


  return image
}


// Define a function to clear map and add a Damage Assesment panel
function home() {
  var image = clear()

  mapPanel_building.add(footagePanel)
  return image
}


// Define a Draw a Polygon button
var drawingTools = mapPanel_building.drawingTools();

drawingTools.setShown(false);

while (drawingTools.layers().length() > 0) {
  var layer = drawingTools.layers().get(0);
  drawingTools.layers().remove(layer);
}

var dummyGeometry = ui.Map.GeometryLayer({ 
  geometries: null,
  name: "geometry",
  color: "23cba7",
}).setShown(false);

drawingTools.layers().add(dummyGeometry)

function clearGeometry() {
  var layers = drawingTools.layers();
  layers.get(0).geometries().remove(layers.get(0).geometries().get(0));
}

function drawPolygon() {
  clearGeometry();
  drawingTools.setShape("rectangle");
  drawingTools.draw();
}

function drawPoint() {
  clearGeometry();
  drawingTools.setShape("point");
  //var pointBuffer = point.buffer({'distance': 100});
  drawingTools.draw();
}


// Run a footprints function
function footprints() {
  var aoi = drawingTools.layers().get(0).getEeObject();
  drawingTools.layers().get(0).setShown(false);

  var footprints = ee.FeatureCollection('projects/ee-rengeanzu/assets/location-points-to-polygons')
    .filterBounds(aoi)
    .map(function(feat) {
      return feat.set('area', feat.geometry().area(10)).set('geometry_type', feat.geometry().type());

    })
    .filter(ee.Filter.gt('area', 50))
    .filter(ee.Filter.equals('geometry_type', 'Polygon'));

  var mean = image.reduceRegions({
    collection: footprints,
    reducer: ee.Reducer.mean(),
    scale: 10
  });
  var damaged = mean.filter(ee.Filter.gt('mean', 1.96)) //95% confidence period

  var totalCount = mean.size()
  var damagedCount = damaged.size()
  var proportion = ((damagedCount.divide(totalCount)).multiply(100)).int() // .evaluate(function(val){return val});

  var sumLabel2 = ui.Label({
    value: 'Calculating...'
  })
  var meanLabel2 = ui.Label({
    value: 'Calculating...'
  })

  damagedCount.evaluate(function(val) {
    sumLabel2.setValue(val)
  });
  proportion.evaluate(function(val) {
    meanLabel2.setValue(val)
  });

  var sumLabel1 = ui.Label("Number of damaged buildings in the area: ")
  var meanLabel1 = ui.Label("Proportion (%): ")

  var sumPanel = ui.Panel({
    layout: ui.Panel.Layout.flow('horizontal'),
    widgets: [sumLabel1, sumLabel2]
  })
  var meanPanel = ui.Panel({
    layout: ui.Panel.Layout.flow('horizontal'),
    widgets: [meanLabel1, meanLabel2]
  })

  var statsPanel = ui.Panel([sumPanel, meanPanel])

  footagePanel.widgets().set(4, statsPanel);

  Export.table.toDrive({
    collection: damaged,
    description: '_damaged_buildings',
  });

  Export.image.toDrive({
    image: image.clip(aoi),
    scale: 10,
    description: '_damage',
  });

  var outlines = ui.Map.Layer(damaged, {
    color: 'red'
  }, 'footprints');

  mapPanel_building.layers().set(1, outlines)
  mapPanel_building.layers().get(0).setShown(false)
}

var image = home()

drawingTools.onDraw(footprints);

mapPanel_building.add(buttonPanel);




/// ------------------------------------- LANDSLIDE ------------------------------------- ///
//LANDSLIDE DETECTION LAYER AND MASKED LAYER Create a UI panel
var panel_landslide = ui.Panel({style: {width: '400px'}});
var mapPanel_landslide = ui.Map();

// Create a label
var titleLabel = ui.Label('Landslide Detection Visualization Tool');
panel_landslide.add(titleLabel);

// Add panel and map to the interface
////ui.root.clear();
////ui.root.add(panel);
////ui.root.add(mapPanel);

// Set the center of the landslide area
var center = {lon: 136.89961, lat: 37.39405, zoom: 10};

// Create a circular buffer around the center
var bufferRadius = 15000; // in meters
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
////mapPanel.addLayer(meanDiff.clip(aoi), visParamsOriginal, 'Landslide Detection');

// Add masked landslide detection layer to the map
////mapPanel.addLayer(maskedDiff.clip(aoi), visParamsMasked, 'Masked Landslide Detection');


// Set the map center and zoom level
////mapPanel.setCenter(center.lon, center.lat, center.zoom);


// EDITS tbm: Building footprint
// Multipoint code to clip anaysis to land?
// NDVI/NIR?
// Set threshold to improve on the display




/// ------------------------------------- FIRE ------------------------------------- ///
var panel_fire = ui.Panel({style: {width: '400px'}});
var mapPanel_fire = ui.Map();

// Create a label
var titleLabel = ui.Label('Fire Burn Area Visualization Tool');
panel_fire.add(titleLabel);

// Dataset selection dropdown
var datasetSelector = ui.Select({
  items: ['ESA/CCI/FireCCI/5_1', 'MODIS/061/MCD64A1'],
  value: 'ESA/CCI/FireCCI/5_1',
  onChange: updateMap
});
panel_fire.add(ui.Label('Select Dataset'));
panel_fire.add(datasetSelector);

// Year selection slider
var yearSlider = ui.Slider({
  min: 2000,
  max: 2022,
  value: 2017,
  step: 1,
  onChange: updateMap
});
panel_fire.add(ui.Label('Select Year'));
panel_fire.add(yearSlider);

// Add panel and map to the interface
////ui.root.clear();
////ui.root.add(panel_fire);
////ui.root.add(mapPanel_fire);

function updateMap() {
  var datasetName = datasetSelector.getValue();
  var year = yearSlider.getValue();
  var startDate = ee.Date.fromYMD(year, 1, 1);
  var endDate = startDate.advance(1, 'year');

  var dataset = ee.ImageCollection(datasetName)
                  .filterDate(startDate, endDate);
  var burnedArea = dataset.select('BurnDate');
  var maxBurnedArea = burnedArea.max();
  
  // Set visualization parameters and center
  var visParams;
  var center;
  if (datasetName === 'ESA/CCI/FireCCI/5_1') {
    visParams = {min: 1, max: 366, palette: ['ff0000', 'fd4100', 'fb8200', 'f9c400', 'f2ff00', 'b6ff05',
    '7aff0a', '3eff0f', '02ff15', '00ff55', '00ff99', '00ffdd',
    '00ddff', '0098ff', '0052ff', '0210ff', '3a0dfb', '7209f6',
    'a905f1', 'e102ed', 'ff00cc', 'ff0089', 'ff0047', 'ff0004']};
    center = {lon: 6.746, lat: 46.529, zoom: 2};
  } else if (datasetName === 'MODIS/061/MCD64A1') {
    visParams = {min: 30.0, max: 341.0, palette: ['4e0400', '951003', 'c61503', 'ff1901']};
    center = {lon: 6.746, lat: 46.529, zoom: 2};
  }

  mapPanel_fire.clear();
  mapPanel_fire.setCenter(center.lon, center.lat, center.zoom);
  mapPanel_fire.addLayer(maxBurnedArea, visParams, 'Burned Area');
  mapPanel_fire.add(buttonPanel);
}

////updateMap();  // Initial map update





/// ------------------------------------- TSUNAMI ------------------------------------- ///
// Set the map center and view mode
var mapPanel_tsunami = ui.Map();
mapPanel_tsunami.centerObject(initialPoint, 14);
mapPanel_tsunami.setOptions("SATELLITE");

// Load the elevation data
var elevation = ee.Image('USGS/SRTMGL1_003').clip(aoi);

// Load the CSV file containing building footprints
var csv = ee.FeatureCollection('projects/ee-rengeanzu/assets/202312BuildingFootprints').filterBounds(aoi);

// Load the elevation data
var elevation = ee.Image('USGS/SRTMGL1_003').clip(aoi);

// Array of flood levels
var floodLevels = [1, 3, 5, 7, 9, 11];

// Variable to store the previous flooded area
var previousFlooded = ee.Image.constant(0).clip(aoi);

var bluePalette = [
    '#FFFF00',  // Yellow
    '#FFD700', // Gold
    '#FFA500',  
    '#4169E1',  // Royal blue
    '#0000CD',  // Medium blue
    '#00008B'  // Dark blue
   ];


var proportion = []
var totlArea;

// Iterate over different flood levels
floodLevels.forEach(function(level, index) {
    // Compute the flooded area at the current water level
    var currentFlooded = elevation.lte(level);

    // Exclude areas affected by previous water levels
    var newFloodedArea = currentFlooded.and(previousFlooded.not());

    // Update the previously flooded area
    previousFlooded = previousFlooded.or(currentFlooded);


    var visualization = {
        palette: [bluePalette[index]],
        min: 0,
        max: 1,
        opacity: 0.5
    };

    // Visualize the newly flooded area at the current water level
    mapPanel_tsunami.addLayer(newFloodedArea.updateMask(newFloodedArea), visualization, 'Flooded at ' + level + 'm');
});



// Create a panel to display layer annotations
var legend = ui.Panel({
    style: {
        position: 'bottom-left',
        padding: '8px 15px'
    }
});

// Add a title for layer annotations
var legendTitle = ui.Label({
    value: 'Layer Description',
    style: {
        fontWeight: 'bold',
        fontSize: '18px',
        margin: '0 0 4px 0',
        padding: '0'
    }
});
legend.add(legendTitle);

var layers = [
    {name: 'Flooded at 1m', color: bluePalette[0]},
    {name: 'Flooded at 3m', color: bluePalette[1]},
    {name: 'Flooded at 5m', color: bluePalette[2]},
    {name: 'Flooded at 7m', color: bluePalette[3]},
    {name: 'Flooded at 9m', color: bluePalette[4]},
    {name: 'Flooded at 11m', color: bluePalette[5]},
];

layers.forEach(function(layer) {
    // Create a panel with a horizontal layout
    var layerItem = ui.Panel({
        widgets: [
            ui.Label({
                value: '■', // Use a square symbol for the color block
                style: {
                    color: layer.color, // Set the color of the color block
                    fontWeight: 'bold',
                    fontSize: '18px', // Adjust size to fit annotation
                    margin: '0 4px 0 0' // Right margin to separate color block and text
                }
            }),
            ui.Label({
                value: layer.name,
                style: {
                    color: 'black', // Text color
                    margin: '0',
                    fontSize: '16px' // Text size
                }
            })
        ],
        layout: ui.Panel.Layout.flow('horizontal')
    });
    // Add the annotation for each layer to the legend panel
    legend.add(layerItem);
});




// Create a slider
var slider = ui.Slider({
  min: 1,
  max: 11,
  step: 2,
  style: {width: '200px'}
});

// Create a label
var label = ui.Label('Flooded area proportion: ' + proportion[0]); // Display initial value

// Define a function to run when the slider value changes
slider.onChange(function(value) {
  // Update the label based on the slider value
  label.setValue('Flooded area proportion: ' + proportion[value]);
});

// Add the slider and label to a panel
var panel = ui.Panel({
  widgets: [slider, label],
  layout: ui.Panel.Layout.flow('vertical'),
    style: {
    position: 'bottom-left',
  }
});


/// ------------------------------------- TSUNAMI (BUILDING) ------------------------------------- ///
var mapPanel_tsunami2 = ui.Map();
mapPanel_tsunami2.centerObject(initialPoint, 14);
mapPanel_tsunami2.setOptions("SATELLITE");


// Initialize previous flooded area
var previousFlooded = ee.Image.constant(0);

// Compute and display buildings affected at a specific flood level

function displayFloodImpact(floodLevel) {
    // Flooded area at the current water level
    var flooded = elevation.lte(floodLevels);
    
    // Exclude areas affected by previous water levels
    var newFlooded = flooded.and(previousFlooded.not());

    // Update the previously flooded area
    previousFlooded = previousFlooded.or(flooded);

    var floodedPoints = csv.map(function(feature) {
        return feature.set('isFlooded', newFlooded.reduceRegion({
            reducer: ee.Reducer.first(),
            geometry: feature.geometry(),
            scale: 30
        }).get('elevation'));
    }).filter(ee.Filter.eq('isFlooded', 1));

    // Visualize flooded buildings with the new color palette
    mapPanel_tsunami2.addLayer(floodedPoints, 
    {color: [[bluePalette[0]], [bluePalette[1]], [bluePalette[2]], [bluePalette[3]], [bluePalette[4]], [bluePalette[5]]]
    [floodLevels.indexOf(floodLevels)]}, 
    'Flooded Points at ' + floodLevels + 'm');
}

floodLevels.forEach(displayFloodImpact);


// Create a panel to display layer annotations
var legend = ui.Panel({
    style: {
        position: 'bottom-left',
        padding: '8px 15px'
    }
});

// Add layer annotation title
var legendTitle = ui.Label({
    value: 'Layer Description',
    style: {
        fontWeight: 'bold',
        fontSize: '18px',
        margin: '0 0 4px 0',
        padding: '0'
    }
});
legend.add(legendTitle);

var layers = [
    {name: 'Flooded buildings at 1m', color: bluePalette[0]},
    {name: 'Flooded buildings at 3m', color: bluePalette[1]},
    {name: 'Flooded buildings at 5m', color: bluePalette[2]},
    {name: 'Flooded buildings at 7m', color: bluePalette[3]},
    {name: 'Flooded buildings at 9m', color: bluePalette[4]},
    {name: 'Flooded buildings at 11m', color:bluePalette[5]}
];

layers.forEach(function(layer) {
    // Create a panel with horizontal layout
    var layerItem = ui.Panel({
        widgets: [
            ui.Label({
                value: '■', // Use square symbol to represent color block
                style: {
                    color: layer.color, // Set color of the color block
                    fontWeight: 'bold',
                    fontSize: '18px', // Adjust size to fit annotation
                    margin: '0 4px 0 0' // Right margin for separation between color block and text
                }
            }),
            ui.Label({
                value: layer.name,
                style: {
                    color: 'black', // Text color
                    margin: '0',
                    fontSize: '16px' // Text size
                }
            })
        ],
        layout: ui.Panel.Layout.flow('horizontal')
    });
    // Add annotation for each layer to the legend panel
    legend.add(layerItem);
});



var buildingCounts = []; // Array to store the number of buildings at each flood level
var totalBuildingCount = 0; // Variable to store the total number of buildings

// Iterate over each flood level
floodLevels.forEach(function(level) {
    // Compute the mask for flooded areas
    var floodedArea = elevation.lte(level).rename('flooded');

    // Extract buildings within flooded areas
    var floodedBuildings = csv.filterBounds(aoi).filterBounds(floodedArea.geometry()).size();
    
    // Add the count of buildings at each flood level to the array
    buildingCounts.push(floodedBuildings.getInfo());
    
    // Increment the total building count
    totalBuildingCount += floodedBuildings.getInfo();
});

// Calculate the proportion of buildings at each flood level
var proportionBuildings = buildingCounts.map(function(count) {
    return count / totalBuildingCount;
});

// Print the results
print('Building counts for each flood level:', buildingCounts);
print('Total building count:', totalBuildingCount);
print('Proportion of buildings for each flood level:', proportionBuildings);



// Create a slider
var slider = ui.Slider({
  min: 1,
  max: 11,
  value: 1,
  step: 2,
  style: {width: '200px'}
});

// Function to update the displayed proportion when the slider value changes
var updateProportion = function(value) {
  // Calculate the corresponding flood level
  var index = (value - 1) / 2;
  
  // Get the proportion of buildings at the flood level
  var proportion = proportionBuildings[Math.floor(index)];
  
  // Display the proportion in a label
  label.setValue('Proportion of flooded area at Flood Level ' + value + 'm: ' + proportion.toFixed(4));
};

// Trigger the updateProportion function when the slider value changes
slider.onChange(updateProportion);

// Create a label and set its initial value
var label = ui.Label('Proportion of flooded area at Flood Level 1m: 0');

// Add the slider and label to a panel
var panel = ui.Panel({
  widgets: [slider, label],
  layout: ui.Panel.Layout.flow('vertical'),
  style: {
    position: 'bottom-left',
    padding: '8px'
  }
});


/// ------------------------------------- BUTTON FUNCTION ------------------------------------- ///
// Define a function to witch a MapPanel
function updateLayer() {
  var selectedLayer = layerSelect.getValue();

  if (selectedLayer === 'DAMAGED BUILDING') {
    showDamageLayer();
  } else if (selectedLayer === 'LANDSLIDE') {
    showLandslideLayer();
  } else if (selectedLayer === 'FIRE') {
    showFireLayer();
  } else if (selectedLayer === 'TSUNAMI(AREA)') {
    showTsunamiLayer();
  } else if (selectedLayer === 'TSUNAMI(BUILDING)'){
    showTsunami2Layer();
  }
}

// Define a function to show Damaged MapPanel
function showDamageLayer() {
  removeLandslideLayer(); 
  removeFirelideLayer(); 
  removeTsunamiLayer();
  removeTsunami2Layer();
 
  ui.root.add(mapPanel_building);
  
  var image = home()
  drawingTools.onDraw(footprints);
  
  mapPanel_building.add(buttonPanel); 
}

// Define a function to show Landslide MapPanel
function showLandslideLayer() {
  removeDamageLayer();
  removeFirelideLayer();
  removeTsunamiLayer();
  removeTsunami2Layer();
  
  ui.root.add(panel_landslide);
  ui.root.add(mapPanel_landslide);
  
  mapPanel_landslide.addLayer(meanDiff.clip(aoi), visParamsOriginal, 'Landslide Detection');
  mapPanel_landslide.addLayer(maskedDiff.clip(aoi), visParamsMasked, 'Masked Landslide Detection');
  mapPanel_landslide.setCenter(center.lon, center.lat, center.zoom);
  mapPanel_landslide.add(buttonPanel);
  
}

// Define a function to show Fire MapPanel
function showFireLayer() {
  removeDamageLayer();
  removeLandslideLayer(); 
  removeTsunamiLayer();
  removeTsunami2Layer();
  
  ui.root.add(panel_fire);
  ui.root.add(mapPanel_fire);
  updateMap();
}

// Define a function to show Tsunami MapPanel
function showTsunamiLayer() {
  removeDamageLayer();
  removeLandslideLayer();
  removeFirelideLayer();
  removeTsunami2Layer();

  ui.root.add(mapPanel_tsunami);
  
  mapPanel_tsunami.add(buttonPanel);
  mapPanel_tsunami.add(ui.Label('Simulation of tsunami inundation on City of Wajima', {position: 'top-left', fontWeight: 'bold', fontSize: '24px'}));
  mapPanel_tsunami.add(legend);
  mapPanel_tsunami.add(panel);
  
}

function showTsunami2Layer(){
  removeDamageLayer();
  removeLandslideLayer();
  removeFirelideLayer();
  removeTsunamiLayer();
  
    ui.root.add(mapPanel_tsunami2);
  
  mapPanel_tsunami2.add(buttonPanel);
  mapPanel_tsunami2.add(ui.Label('Simulation of tsunami inundation on buildings', {position: 'top-left', fontWeight: 'bold', fontSize: '24px'}));
  mapPanel_tsunami2.add(legend);
  mapPanel_tsunami2.add(panel);
  
}


// Define a function to remove Damaged MapPanel
function removeDamageLayer() {
  mapPanel_building.clear();
  ui.root.clear();
}

// Define a function to show Landslide MapPanel
function removeLandslideLayer() {
  mapPanel_landslide.clear();
  ui.root.clear();
}

// Define a function to show Fire MapPanel
function removeFirelideLayer() {
  mapPanel_fire.clear();
  ui.root.clear();
}

// Define a function to show Tsunami MapPanel
function removeTsunamiLayer() {
  mapPanel_tsunami.clear();
  ui.root.clear();
 }
 
 function removeTsunami2Layer() {
  mapPanel_tsunami2.clear();
  ui.root.clear();
 }
