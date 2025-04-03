import './stubs.js'
import App from '../src/predtimechart.js';

const {test} = QUnit;


//
// an options object to work with
//

const covid19ForecastsVizTestOptions = {
    "available_as_ofs": {
        "week_ahead_incident_deaths": ["2022-01-22", "2022-01-29"]
    },
    "current_date": "2022-01-29",
    "disclaimer": "Most forecasts have failed to reliably predict rapid changes in the trends of reported cases and hospitalizations. Due to this limitation, they should not be relied upon for decisions about the possibility or timing of rapid changes in trends.",
    "initial_as_of": "2022-01-29",
    "initial_checked_models": ["COVIDhub-baseline", "COVIDhub-ensemble"],
    "initial_interval": "95%",
    "initial_target_var": "week_ahead_incident_deaths",
    "initial_task_ids": {"unit": "48"},
    "initial_xaxis_range": null,
    "initial_yaxis_range": null,
    "intervals": ["0%", "50%", "95%"],
    "models": ["COVIDhub-ensemble", "COVIDhub-baseline"],
    "target_variables": [{
        "value": "week_ahead_incident_deaths",
        "text": "week ahead incident deaths",
        "plot_text": "week ahead incident deaths"
    }],
    "task_ids": {
        "week_ahead_incident_deaths": {
            "unit": [{"value": "48", "text": "Texas"}, {"value": "US", "text": "US"}]
        }
    },
};


//
// initialize() function placeholders
//

function _fetchData(...args) {
}


// prevent initialize() from trying to get data
App.fetchDataUpdatePlot = function (...args) {
};


//
// options DIV tests
//

QUnit.module('options DIV');

test('initialize() creates SELECTs', assert => {
    // tests that options SELECTs were created

    // case: one task_ids
    App.initialize('qunit-fixture', _fetchData, true, covid19ForecastsVizTestOptions);
    ["target_variable", "unit", "intervals"].forEach((selectId) => {
        const selectEle = document.getElementById(selectId);
        assert.true(selectEle !== null);
    });

    // case: two tasks_ids
    const optionsCopy = structuredClone(covid19ForecastsVizTestOptions);
    optionsCopy['task_ids'] = {
        "week_ahead_incident_deaths": {
            "scenario_id": [{"value": "1", "text": "scenario 1"}, {"value": "2", "text": "scenario 2"}],
            "location": [{"value": "48", "text": "Texas"}, {"value": "US", "text": "US"}]
        }
    };
    optionsCopy['initial_task_ids'] = {"scenario_id": "1", "location": "48"};
    App.initialize('qunit-fixture', _fetchData, true, optionsCopy);
    ["target_variable", "scenario_id", "location", "intervals"].forEach((selectId) => {
        const selectEle = document.getElementById(selectId);
        assert.true(selectEle !== null);
    });
});


//
// selectedTaskIDs() tests
//

QUnit.module('selectedTaskIDs()');

test('selectedTaskIDs() and selectedTaskIDValues() are correct', assert => {
    // case: two tasks_ids
    const optionsCopy = structuredClone(covid19ForecastsVizTestOptions);
    optionsCopy['task_ids'] = {
        "scenario_id": [{"value": "1", "text": "scenario 1"}, {"value": "2", "text": "scenario 2"}],
        "location": [{"value": "48", "text": "Texas"}, {"value": "US", "text": "US"}]
    };
    optionsCopy['initial_task_ids'] = {"scenario_id": "1", "location": "48"};
    App.initialize('qunit-fixture', _fetchData, true, optionsCopy);

    // test selectedTaskIDs()
    assert.deepEqual(App.selectedTaskIDs(), {
        "scenario_id": {"value": "1", "text": "scenario 1"},
        "location": {"value": "48", "text": "Texas"}
    });

    // test selectedTaskIDValues()
    assert.deepEqual(App.selectedTaskIDValues(), {"scenario_id": "1", "location": "48"});
});


//
// optional disclaimer tests
//

QUnit.module('optional disclaimer');

test('initialize() creates .forecastViz_disclaimer <P> only if disclaimer present', assert => {
    // case 1: disclaimer is present
    let optionsCopy = structuredClone(covid19ForecastsVizTestOptions);
    App.initialize('qunit-fixture', _fetchData, true, optionsCopy);
    let foundEles = document.getElementsByClassName('forecastViz_disclaimer');
    assert.equal(foundEles.length, 1);

    // case 1: disclaimer is missing
    optionsCopy = structuredClone(covid19ForecastsVizTestOptions);
    delete optionsCopy['disclaimer'];
    App.initialize('qunit-fixture', _fetchData, true, optionsCopy);
    foundEles = document.getElementsByClassName('forecastViz_disclaimer');
    assert.equal(foundEles.length, 0);
});
