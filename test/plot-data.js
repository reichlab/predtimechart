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
