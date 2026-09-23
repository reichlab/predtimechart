import './stubs.js'
import App from '../src/predtimechart.js';

const {test} = QUnit;


//
// an options object and forecast data to work with
//

const testOptions = {
    "available_as_ofs": {"week_ahead_incident_deaths": ["2022-01-22", "2022-01-29"]},
    "current_date": "2022-01-29",
    "initial_as_of": "2022-01-29",
    "initial_checked_models": ["COVIDhub-baseline"],
    "initial_interval": "95%",
    "initial_target_var": "week_ahead_incident_deaths",
    "initial_task_ids": {"unit": "48"},
    "initial_xaxis_range": null,
    "initial_yaxis_range": null,
    "intervals": ["0%", "50%", "80%", "95%"],
    "models": ["COVIDhub-baseline"],
    "target_variables": [{
        "value": "week_ahead_incident_deaths",
        "text": "week ahead incident deaths",
        "plot_text": "week ahead incident deaths"
    }],
    "task_ids": {
        "week_ahead_incident_deaths": {"unit": [{"value": "48", "text": "Texas"}, {"value": "US", "text": "US"}]}
    },
};


// forecast data including the optional q0.1/q0.9 that back the 80% interval. distinct values per quantile level let
// tests tell which pair a band was built from
function forecastsWith80Pct() {
    return {
        "COVIDhub-baseline": {
            "target_end_date": ["2022-01-29", "2022-02-05"],
            "q0.025": [10, 11],
            "q0.1": [20, 21],
            "q0.25": [30, 31],
            "q0.5": [40, 41],
            "q0.75": [50, 51],
            "q0.9": [60, 61],
            "q0.975": [70, 71]
        }
    };
}


// "" but with no backing quantiles for the 80% interval, ala a hub that doesn't require the 0.1 and 0.9 quantile levels
function forecastsWithout80Pct() {
    const forecasts = forecastsWith80Pct();
    delete forecasts["COVIDhub-baseline"]["q0.1"];
    delete forecasts["COVIDhub-baseline"]["q0.9"];
    return forecasts;
}


//
// helpers
//

// prevent initialize() from trying to get data
App.fetchDataUpdatePlot = function (...args) {
};


/**
 * Initializes App with `intervals`/`initial_interval` overrides plus `forecasts`, and returns `getPlotlyData()`'s value.
 */
function plotDataFor(selectedInterval, forecasts, intervals) {
    const optionsCopy = structuredClone(testOptions);
    optionsCopy['intervals'] = intervals === undefined ? testOptions['intervals'] : intervals;
    optionsCopy['initial_interval'] = selectedInterval;
    const error = App.initialize('qunit-fixture', function (...args) {
    }, true, optionsCopy);
    if (error) {
        throw `initialize() failed: ${error}`;
    }

    App.state.forecasts = forecasts;
    return App.getPlotlyData();
}


// returns the interval band traces in `plotData` (the filled polygons, as opposed to the point forecast lines)
function bandTraces(plotData) {
    return plotData.filter((trace) => trace['fill'] === 'toself');
}


// returns the point forecast line trace for `model` in `plotData` (the one carrying the tooltip)
function pointForecastTrace(plotData, model) {
    return plotData.filter((trace) => (trace['name'] === model) && trace.hasOwnProperty('hovertemplate'))[0];
}


//
// interval band tests
//

QUnit.module('interval bands');

test('80% interval band is built from q0.1/q0.9', assert => {
    const plotData = plotDataFor('80%', forecastsWith80Pct());
    const bands = bandTraces(plotData);
    assert.equal(bands.length, 1);

    // the band is the lower edge followed by the reversed upper edge. q0.1 = [20, 21] and q0.9 = [60, 61]
    assert.deepEqual(bands[0]['x'], ["2022-01-29", "2022-02-05", "2022-02-05", "2022-01-29"]);
    assert.deepEqual(bands[0]['y'], [20, 21, 61, 60]);

    // the tooltip reports the interval and its bounds
    const pointTrace = pointForecastTrace(plotData, 'COVIDhub-baseline');
    assert.deepEqual(pointTrace['customdata'], [[20, 60], [21, 61]]);
    assert.true(pointTrace['hovertemplate'].includes('80% PI'));
});


test('50% and 95% interval bands are unchanged', assert => {
    // regression: the pre-existing intervals must keep their quantile pairs. q0.25/q0.75 = [30, 31]/[50, 51] and
    // q0.025/q0.975 = [10, 11]/[70, 71]
    [['50%', [30, 31, 51, 50]], ['95%', [10, 11, 71, 70]]].forEach(([selectedInterval, expBandY]) => {
        const plotData = plotDataFor(selectedInterval, forecastsWith80Pct());
        const bands = bandTraces(plotData);
        assert.equal(bands.length, 1, `one band for ${selectedInterval}`);
        assert.deepEqual(bands[0]['y'], expBandY, `band y for ${selectedInterval}`);
        assert.true(pointForecastTrace(plotData, 'COVIDhub-baseline')['hovertemplate'].includes(`${selectedInterval} PI`));
    });
});


test('0% interval plots no band', assert => {
    const plotData = plotDataFor('0%', forecastsWith80Pct());
    assert.equal(bandTraces(plotData).length, 0);

    // the median line is still plotted, just with no interval in its tooltip
    const pointTrace = pointForecastTrace(plotData, 'COVIDhub-baseline');
    assert.deepEqual(pointTrace['y'], [40, 41]);  // q0.5
    assert.equal(pointTrace['customdata'], null);
    assert.false(pointTrace['hovertemplate'].includes('PI'));
});


test('an interval width we cannot map plots no band', assert => {
    // the options schema admits any '<integer>%' width, but we only have quantile keys for 50%, 80%, and 95%. an
    // unmappable one behaves like '0%' rather than throwing
    const plotData = plotDataFor('37%', forecastsWith80Pct(), ["0%", "37%", "95%"]);
    assert.equal(bandTraces(plotData).length, 0);
    assert.deepEqual(pointForecastTrace(plotData, 'COVIDhub-baseline')['y'], [40, 41]);  // q0.5
});


//
// tests for the 80% interval not being available
//

QUnit.module('no 80% interval');

test('the interval SELECT offers only the configured intervals', assert => {
    // case: the hub's options omit '80%' (ala a hub that doesn't require the 0.1 and 0.9 quantile levels). the
    // interval dropdown must not offer it
    plotDataFor('95%', forecastsWithout80Pct(), ["0%", "50%", "95%"]);
    let optionValues = Array.from(document.getElementById('intervals').options).map((option) => option.value);
    assert.deepEqual(optionValues, ["0%", "50%", "95%"]);
    assert.false(optionValues.includes('80%'));

    // case: the hub's options include '80%'
    plotDataFor('95%', forecastsWith80Pct());
    optionValues = Array.from(document.getElementById('intervals').options).map((option) => option.value);
    assert.deepEqual(optionValues, ["0%", "50%", "80%", "95%"]);
});


test('80% selected with no backing quantiles plots no band', assert => {
    // case: '80%' is offered but the forecast data has no q0.1/q0.9 - e.g., a model that submitted only the required
    // quantile levels. we plot no band rather than throwing on the missing keys
    let plotData;
    try {
        plotData = plotDataFor('80%', forecastsWithout80Pct());
    } catch (error) {
        assert.true(false, `getPlotlyData() threw: ${error}`);
        return;
    }

    assert.equal(bandTraces(plotData).length, 0);

    // the median line is still plotted, with no interval in its tooltip
    const pointTrace = pointForecastTrace(plotData, 'COVIDhub-baseline');
    assert.deepEqual(pointTrace['y'], [40, 41]);  // q0.5
    assert.equal(pointTrace['customdata'], null);
    assert.false(pointTrace['hovertemplate'].includes('PI'));
});


test('the backing quantile check is per model', assert => {
    // case: one model submitted q0.1/q0.9 and another didn't. only the first gets an 80% band
    const optionsCopy = structuredClone(testOptions);
    optionsCopy['models'] = ["COVIDhub-baseline", "COVIDhub-ensemble"];
    optionsCopy['initial_checked_models'] = ["COVIDhub-baseline", "COVIDhub-ensemble"];
    optionsCopy['initial_interval'] = '80%';
    App.initialize('qunit-fixture', function (...args) {
    }, true, optionsCopy);
    App.state.forecasts = {
        ...forecastsWith80Pct(),  // COVIDhub-baseline: has q0.1/q0.9
        "COVIDhub-ensemble": {    // "": does not
            "target_end_date": ["2022-01-29", "2022-02-05"],
            "q0.025": [110, 111],
            "q0.25": [130, 131],
            "q0.5": [140, 141],
            "q0.75": [150, 151],
            "q0.975": [170, 171]
        }
    };

    const plotData = App.getPlotlyData();
    const bands = bandTraces(plotData);
    assert.equal(bands.length, 1);
    assert.equal(bands[0]['name'], 'COVIDhub-baseline');
    assert.deepEqual(bands[0]['y'], [20, 21, 61, 60]);  // q0.1/q0.9

    // both models' median lines are plotted
    assert.deepEqual(pointForecastTrace(plotData, 'COVIDhub-baseline')['y'], [40, 41]);
    assert.deepEqual(pointForecastTrace(plotData, 'COVIDhub-ensemble')['y'], [140, 141]);
});


//
// forecast sorting tests
//

QUnit.module('forecast sorting');

test('all quantile levels stay aligned when sorting by target end date', assert => {
    // `getPlotlyData()` sorts each model's forecasts by target end date. the optional q0.1/q0.9 must be reordered
    // along with the rest, o/w the 80% band would be plotted against the wrong dates
    const forecasts = forecastsWith80Pct();
    const modelForecasts = forecasts["COVIDhub-baseline"];
    modelForecasts['target_end_date'] = ["2022-02-05", "2022-01-29"];  // out of order
    Object.keys(modelForecasts).forEach((key) => {
        if (key !== 'target_end_date') {
            modelForecasts[key].reverse();  // ex: q0.1 becomes [21, 20]
        }
    });

    const plotData = plotDataFor('80%', forecasts);
    assert.deepEqual(modelForecasts['target_end_date'], ["2022-01-29", "2022-02-05"]);
    assert.deepEqual(modelForecasts['q0.1'], [20, 21]);
    assert.deepEqual(modelForecasts['q0.9'], [60, 61]);
    assert.deepEqual(modelForecasts['q0.5'], [40, 41]);

    // the band matches the sorted dates
    const bands = bandTraces(plotData);
    assert.deepEqual(bands[0]['x'], ["2022-01-29", "2022-02-05", "2022-02-05", "2022-01-29"]);
    assert.deepEqual(bands[0]['y'], [20, 21, 61, 60]);
});


//
// season mode tests. season mode is off by default, in which case the plot is the same as it was before season mode
// was added: all the truth data, and no other seasons behind it
//

QUnit.module('season mode: other seasons traces');


// truth spanning three seasons. testOptions' as_of is 2022-01-29, which makes 2021-2022 the selected season
function threeSeasonTruth() {
    return {
        "date": ["2019-12-28", "2020-12-26", "2021-12-25", "2022-01-29"],
        "y": [10, 20, 30, 40]
    };
}


/**
 * Initializes App with `currentTruth` as its current truth and no forecasts, and returns `getPlotlyData()`'s value.
 *
 * @param currentTruth {Object} ala _fetchData()'s truth format
 * @param isSeasonMode {Boolean} whether to turn season mode on. defaults to true
 * @param startYear {Number} the season to select. defaults to the one testOptions' as_of date falls in
 * @param startMonth {Number} the season start month. defaults to August, ala DEFAULT_SEASON_START_MONTH
 * @param selectedTruth {Array} ala `state.selected_truth`. defaults to all three checkboxes being checked
 */
function plotDataForTruth(currentTruth, {isSeasonMode = true, startYear = null, startMonth = null, selectedTruth = null} = {}) {
    const error = App.initialize('qunit-fixture', function (...args) {
    }, true, structuredClone(testOptions));
    if (error) {
        throw `initialize() failed: ${error}`;
    }

    App.state.current_truth = currentTruth;
    App.state.as_of_truth = [];
    App.state.forecasts = {};
    App.state.is_season_mode = isSeasonMode;
    App.state.selected_truth = (selectedTruth === null) ? ['Current Target', 'Target as of', 'Other Seasons'] : selectedTruth;
    if (startMonth !== null) {
        App.state.season_start_month = startMonth;
    }
    if (startYear !== null) {
        App.state.selected_season_start_year = startYear;
    }
    return App.getPlotlyData();
}


// returns the other seasons' traces in `plotData`
function seasonTraces(plotData) {
    return plotData.filter((trace) => trace.hasOwnProperty('line') && (trace['line']['color'] === 'lightgray'));
}


// returns the named foreground truth trace in `plotData`, or undefined if it isn't there
function truthTrace(plotData, name) {
    return plotData.filter((trace) => trace['name'] === name)[0];
}


test('one trace per season other than the selected one, oldest first', assert => {
    const plotData = plotDataForTruth(threeSeasonTruth());
    assert.deepEqual(seasonTraces(plotData).map((trace) => trace['name']), ['2019-2020', '2020-2021']);
});


test('seasons after the selected one are included too', assert => {
    const traces = seasonTraces(plotDataForTruth(threeSeasonTruth(), {startYear: 2019}));
    assert.deepEqual(traces.map((trace) => trace['name']), ['2020-2021', '2021-2022']);
    assert.deepEqual(traces[0]['x'], ['2019-12-26'], '2020-2021 shifted back by one year');
    assert.deepEqual(traces[1]['x'], ['2019-12-25', '2020-01-29'], '2021-2022 shifted back by two years');
});


test('each season is shifted onto the selected season', assert => {
    const traces = seasonTraces(plotDataForTruth(threeSeasonTruth()));
    assert.deepEqual(traces[0]['x'], ['2021-12-28'], '2019-2020 shifted by two years');
    assert.deepEqual(traces[0]['y'], [10], 'y values are untouched');
    assert.deepEqual(traces[1]['x'], ['2021-12-26'], '2020-2021 shifted by one year');
    assert.deepEqual(traces[1]['y'], [20]);
});


test('tooltip is the season name alone', assert => {
    const traces = seasonTraces(plotDataForTruth(threeSeasonTruth()));
    assert.equal(traces[0]['hovertemplate'], '<b>2019-2020</b><extra></extra>');
});


test('season traces are drawn behind the rest of the plot', assert => {
    const plotData = plotDataForTruth(threeSeasonTruth());
    assert.equal(plotData[0]['name'], '2019-2020', 'oldest season is first, i.e., furthest back');
    assert.equal(plotData[1]['name'], '2020-2021');

    const currentTruthIdx = plotData.findIndex((trace) => trace['name'] === 'Selected season, current data');
    assert.true(currentTruthIdx > 1, 'the unshifted current data line is drawn on top of the season traces');
});


test('no traces when there is no other season', assert => {
    assert.deepEqual(seasonTraces(plotDataForTruth({"date": ["2021-12-25", "2022-01-29"], "y": [30, 40]})), []);
    assert.deepEqual(seasonTraces(plotDataForTruth({"date": [], "y": []})), []);
    assert.deepEqual(seasonTraces(plotDataForTruth([])), []);
});


test('no traces when not in season mode', assert => {
    assert.deepEqual(seasonTraces(plotDataForTruth(threeSeasonTruth(), {isSeasonMode: false})), []);
});


test('no traces when "Other seasons, current data" is unchecked', assert => {
    const plotData = plotDataForTruth(threeSeasonTruth(), {selectedTruth: ['Current Target', 'Target as of']});
    assert.deepEqual(seasonTraces(plotData), [], 'no other seasons');
    assert.notEqual(truthTrace(plotData, 'Selected season, current data'), undefined, 'but the selected season stays');
});


test('the season start month moves the season boundaries', assert => {
    // with a January start each season is one calendar year, so 2022-01-29 is in season '2022' and the three other
    // dates each land in their own single-year season
    const traces = seasonTraces(plotDataForTruth(threeSeasonTruth(), {startYear: 2022, startMonth: 1}));
    assert.deepEqual(traces.map((trace) => trace['name']), ['2019', '2020', '2021']);
});


//
// truth trimming tests: in season mode - ala the old FluSight Network site - only the selected season is plotted in
// the foreground
//

QUnit.module('season mode: truth trimming');

test('current data is trimmed to the selected season', assert => {
    const plotData = plotDataForTruth(threeSeasonTruth());
    const trace = truthTrace(plotData, 'Selected season, current data');
    assert.deepEqual(trace['x'], ['2021-12-25', '2022-01-29'], 'only the 2021-2022 dates');
    assert.deepEqual(trace['y'], [30, 40]);
});


test('as of data is trimmed to the selected season', assert => {
    const error = App.initialize('qunit-fixture', function (...args) {
    }, true, structuredClone(testOptions));
    if (error) {
        throw `initialize() failed: ${error}`;
    }

    App.state.current_truth = [];
    App.state.as_of_truth = threeSeasonTruth();
    App.state.forecasts = {};
    App.state.is_season_mode = true;

    const trace = truthTrace(App.getPlotlyData(), 'Selected season, as of data 2022-01-29');
    assert.deepEqual(trace['x'], ['2021-12-25', '2022-01-29']);
    assert.deepEqual(trace['y'], [30, 40]);
});


test('no foreground truth trace when no truth falls in the selected season', assert => {
    const plotData = plotDataForTruth({"date": ["2019-12-28", "2020-12-26"], "y": [10, 20]});
    assert.equal(truthTrace(plotData, 'Selected season, current data'), undefined);
    assert.deepEqual(seasonTraces(plotData).map((trace) => trace['name']), ['2019-2020', '2020-2021'],
        'but the other seasons are still overlaid');
});


test('truth is not trimmed, and keeps its old names, when not in season mode', assert => {
    const plotData = plotDataForTruth(threeSeasonTruth(), {isSeasonMode: false});
    const trace = truthTrace(plotData, 'Current Target');
    assert.deepEqual(trace['x'], threeSeasonTruth()['date'], 'every season is plotted');
    assert.deepEqual(trace['y'], threeSeasonTruth()['y']);
    assert.equal(truthTrace(plotData, 'Selected season, current data'), undefined);
});


test('as of data is not trimmed, and keeps its old name, when not in season mode', assert => {
    const error = App.initialize('qunit-fixture', function (...args) {
    }, true, structuredClone(testOptions));
    if (error) {
        throw `initialize() failed: ${error}`;
    }

    App.state.current_truth = [];
    App.state.as_of_truth = threeSeasonTruth();
    App.state.forecasts = {};

    const trace = truthTrace(App.getPlotlyData(), 'Target as of 2022-01-29');
    assert.deepEqual(trace['x'], threeSeasonTruth()['date']);
    assert.deepEqual(trace['y'], threeSeasonTruth()['y']);
});


//
// xaxis range tests: in season mode the selected season owns the xaxis, so that there's no blank room left for other
// seasons
//

QUnit.module('season mode: xaxis range');


/**
 * Sets up #ploty_div ala Plotly either before the first plot or with a plot already drawn.
 *
 * @param existingLayout {Object} null for before the first plot. o/w the layout of the plot already drawn, e.g.,
 *   {xaxis: {range: [...]}, yaxis: {range: [...]}}
 */
function setPlotyDiv(existingLayout) {
    const plotyDiv = document.getElementById('ploty_div');
    if (existingLayout === null) {
        plotyDiv.data = [];
    } else {
        plotyDiv.data = [{}];  // only its length matters
        plotyDiv.layout = existingLayout;
    }
}


// runs `fcn` with Plotly.relayout() captured, and returns the update it was last passed
function captureRelayoutUpdate(fcn) {
    let relayoutUpdate = null;
    const origRelayout = Plotly.relayout;
    Plotly.relayout = function (graphDiv, update) {
        relayoutUpdate = update;
    };
    try {
        fcn();
    } finally {
        Plotly.relayout = origRelayout;
    }
    return relayoutUpdate;
}


// calls App.updatePlot() with Plotly.relayout() captured, and returns the update it was passed. `existingLayout` is
// ala setPlotyDiv()
function relayoutUpdateFor(isResetYLimit, existingLayout = null) {
    setPlotyDiv(existingLayout);
    return captureRelayoutUpdate(() => App.updatePlot(isResetYLimit));
}


// a plot already drawn, showing the 2021-2022 season (ala the xaxis range updatePlot() sets for it)
function seasonPlotLayout() {
    return {xaxis: {range: ['2021-08-01', '2022-07-31']}, yaxis: {range: [0, 50]}};
}


// initializes App ala plotDataForTruth() and returns relayoutUpdateFor(false)
function relayoutUpdateForTruth(isSeasonMode, initialXAxisRange, plottedSeasonStartYear) {
    const error = App.initialize('qunit-fixture', function (...args) {
    }, true, structuredClone(testOptions));
    if (error) {
        throw `initialize() failed: ${error}`;
    }

    App.state.current_truth = threeSeasonTruth();
    App.state.as_of_truth = [];
    App.state.forecasts = {};
    App.state.is_season_mode = isSeasonMode;
    App.state.initial_xaxis_range = initialXAxisRange;
    App.state.plotted_season_start_year = plottedSeasonStartYear;
    return relayoutUpdateFor(false);
}


test('the xaxis range is the selected season, not the caller\'s initial_xaxis_range', assert => {
    // ala a hub pinning a multi-season window
    const relayoutUpdate = relayoutUpdateForTruth(true, ['2019-09-01', '2022-07-01'], null);
    assert.deepEqual(relayoutUpdate['xaxis.range'], ['2021-08-01', '2022-07-31']);
    assert.equal(App.state.plotted_season_start_year, 2021, 'the plotted season is remembered');
});


test('the xaxis range is not re-forced while the season stays the same', assert => {
    // ala already showing this season, possibly zoomed
    const relayoutUpdate = relayoutUpdateForTruth(true, null, 2021);
    assert.equal(relayoutUpdate.hasOwnProperty('xaxis.range'), false, 'a zoom within the season survives a replot');
});


test('the caller\'s initial_xaxis_range wins when not in season mode', assert => {
    const relayoutUpdate = relayoutUpdateForTruth(false, ['2019-09-01', '2022-07-01'], null);
    assert.deepEqual(relayoutUpdate['xaxis.range'], ['2019-09-01', '2022-07-01']);
    assert.equal(App.state.plotted_season_start_year, null, 'no season is plotted');
});


// initializes App in season mode showing the 2021-2022 season, ala after a first updatePlot()
function initializeShowingSeason(initialXAxisRange) {
    const error = App.initialize('qunit-fixture', function (...args) {
    }, true, {...structuredClone(testOptions), initial_season_mode: true});
    if (error) {
        throw `initialize() failed: ${error}`;
    }

    App.state.current_truth = threeSeasonTruth();
    App.state.as_of_truth = [];
    App.state.forecasts = {};
    App.state.initial_xaxis_range = initialXAxisRange;
    App.state.plotted_season_start_year = 2021;
}


test('turning season mode off releases the season\'s xaxis range', assert => {
    initializeShowingSeason(null);
    setPlotyDiv(seasonPlotLayout());
    const relayoutUpdate = captureRelayoutUpdate(() =>
        $('#forecastViz_season_mode').prop('checked', false).trigger('change'));
    assert.equal(relayoutUpdate.hasOwnProperty('xaxis.range'), false, 'the season\'s range is not re-applied');
    assert.equal(relayoutUpdate['xaxis.autorange'], true, 'the xaxis fits all the data again');
    assert.equal(App.state.plotted_season_start_year, null, 'no season is plotted');
});


test('turning season mode off restores the caller\'s initial_xaxis_range', assert => {
    initializeShowingSeason(['2019-09-01', '2022-07-01']);
    setPlotyDiv(seasonPlotLayout());
    const relayoutUpdate = captureRelayoutUpdate(() =>
        $('#forecastViz_season_mode').prop('checked', false).trigger('change'));
    assert.deepEqual(relayoutUpdate['xaxis.range'], ['2019-09-01', '2022-07-01']);
});


test('a zoom is kept on replots outside season mode', assert => {
    // guards the isLeavingSeason check against releasing a zoom when no season was plotted to begin with
    relayoutUpdateForTruth(false, null, null);  // initialize, not in season mode
    const zoomedLayout = {xaxis: {range: ['2020-10-01', '2021-03-01']}, yaxis: {range: [0, 50]}};
    const relayoutUpdate = relayoutUpdateFor(false, zoomedLayout);
    assert.deepEqual(relayoutUpdate['xaxis.range'], ['2020-10-01', '2021-03-01']);
    assert.equal(relayoutUpdate.hasOwnProperty('xaxis.autorange'), false);
});


//
// range slider tests
//

QUnit.module('season mode: range slider');


// initializes App and returns getPlotlyLayout()'s xaxis.rangeslider
function rangesliderFor(isSeasonMode) {
    const error = App.initialize('qunit-fixture', function (...args) {
    }, true, structuredClone(testOptions));
    if (error) {
        throw `initialize() failed: ${error}`;
    }

    App.state.is_season_mode = isSeasonMode;
    return App.getPlotlyLayout().xaxis.rangeslider;
}


test('the range slider is shorter in season mode', assert => {
    assert.deepEqual(rangesliderFor(false), {}, 'Plotly\'s default height outside season mode');
    assert.deepEqual(rangesliderFor(true), {thickness: 0.07}, 'about half as tall in season mode');
});
