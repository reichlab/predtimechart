import './stubs.js'
import App from '../src/predtimechart.js';

const {test} = QUnit;


//
// options objects to work with
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
    "initial_xaxis_range": ["2022-02-03", "2022-02-13"],
    "initial_yaxis_range": [1, 2],
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


const fluMetrocastOptions = {
    "available_as_ofs": {
        "ILI ED visits": ["2025-02-22", "2025-03-01"],
        "Flu ED visits pct": ["2025-02-22", "2025-03-01"]
    },
    "current_date": "2025-03-01",
    "initial_as_of": "2025-03-01",
    "initial_checked_models": ["epiENGAGE-Copycat", "epiENGAGE-GBQR", "epiENGAGE-INFLAenza", "epiforecasts-dyngam"],
    "initial_interval": "95%",
    "initial_target_var": "ILI ED visits",
    "initial_task_ids": {
        "location": "NYC"
    },
    "initial_xaxis_range": null,
    "intervals": ["0%", "50%", "95%"],
    "models": ["epiENGAGE-Copycat", "epiENGAGE-GBQR", "epiENGAGE-INFLAenza", "epiforecasts-dyngam"],
    "target_variables": [
        {
            "plot_text": "ED visits due to ILI",
            "text": "ED visits due to ILI",
            "value": "ILI ED visits"
        },
        {
            "plot_text": "Percentage of ED visits due to influenza",
            "text": "Percentage of ED visits due to influenza",
            "value": "Flu ED visits pct"
        }
    ],
    "task_ids": {
        "ILI ED visits": {
            "location": [
                {"text": "NYC", "value": "NYC"},
                {"text": "Bronx", "value": "Bronx"},
                {"text": "Brooklyn", "value": "Brooklyn"},
                {"text": "Manhattan", "value": "Manhattan"},
                {"text": "Queens", "value": "Queens"},
                {"text": "Staten Island", "value": "Staten Island"}
            ],
            "Flu ED visits pct": {
                "location": [
                    {"text": "Austin", "value": "Austin"},
                    {"text": "Houston", "value": "Houston"},
                    {"text": "Dallas", "value": "Dallas"},
                    {"text": "El Paso", "value": "El Paso"},
                    {"text": "San Antonio", "value": "San Antonio"}
                ]
            }
        }
    }
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
// initialize() validation tests
//

QUnit.module('initialize() basic structural validation');

test('componentDiv not found', assert => {
    assert.throws(
        function () {
            App.initialize('bad-div', null, true, covid19ForecastsVizTestOptions);
        },
        /componentDiv DOM node not found/,
    );
});


test('options object missing', assert => {
    const actValue = App.initialize('qunit-fixture', null, true, null);
    assert.equal(actValue, `options object is required but missing`);
});


test('options object blue sky covid', assert => {
    // per https://stackoverflow.com/questions/9822400/how-to-assert-that-a-function-does-not-raise-an-exception

    // case: description present
    App.initialize('qunit-fixture', null, true, covid19ForecastsVizTestOptions);
    assert.ok(true, "no Error raised");

    // case: description missing
    const optionsCopy = structuredClone(covid19ForecastsVizTestOptions);
    delete optionsCopy['disclaimer'];
    App.initialize('qunit-fixture', null, true, optionsCopy);
    assert.ok(true, "no Error raised");
});


test('options object blue sky flu-metrocast', assert => {
    // per https://stackoverflow.com/questions/9822400/how-to-assert-that-a-function-does-not-raise-an-exception
    App.initialize('qunit-fixture', null, true, fluMetrocastOptions);
    assert.ok(true, "no Error raised");
});


QUnit.module('initialize() options object other structural validation');

test('available_as_ofs at least one key', assert => {
    const optionsCopy = structuredClone(covid19ForecastsVizTestOptions);
    optionsCopy['available_as_ofs'] = {};

    const regExp = /invalid options structure.*available_as_ofs.*"must NOT have fewer than 1 properties/;
    const actValue = App.initialize('qunit-fixture', _fetchData, true, optionsCopy);
    assert.true(regExp.test(actValue));
});


QUnit.module('initialize() options object semantics validation');

test('available_as_ofs keys in target_variables value', assert => {
    const optionsCopy = structuredClone(covid19ForecastsVizTestOptions);
    optionsCopy['available_as_ofs'] = {"bad key": ["2021-01-01"]};

    const regExp = /available_as_ofs key not in target_variables value/;
    const actValue = App.initialize('qunit-fixture', _fetchData, true, optionsCopy);
    assert.true(regExp.test(actValue));
});

test('task_ids keys in target_variables value', assert => {
    const optionsCopy = structuredClone(covid19ForecastsVizTestOptions);
    optionsCopy['task_ids'] = {"bad key": {"unit": [{"value": "48", "text": "Texas"}, {"value": "US", "text": "US"}]}};

    const regExp = /task_ids key not in target_variables value/;
    const actValue = App.initialize('qunit-fixture', _fetchData, true, optionsCopy);
    assert.true(regExp.test(actValue));
});


test('initial_as_of in available_as_ofs array', assert => {
    const optionsCopy = structuredClone(covid19ForecastsVizTestOptions);
    optionsCopy['initial_as_of'] = "2021-01-01";

    const regExp = /initial_as_of not in available_as_ofs/;
    const actValue = App.initialize('qunit-fixture', _fetchData, true, optionsCopy);
    assert.true(regExp.test(actValue));
});


test('initial_checked_models in models', assert => {
    const optionsCopy = structuredClone(covid19ForecastsVizTestOptions);
    optionsCopy['initial_checked_models'] = [null];

    const regExp = /initial_checked_models model not in models/;
    const actValue = App.initialize('qunit-fixture', _fetchData, true, optionsCopy);
    assert.true(regExp.test(actValue));
});


test('initial_interval in intervals', assert => {
    const optionsCopy = structuredClone(covid19ForecastsVizTestOptions);
    optionsCopy['initial_interval'] = "not in intervals";

    const regExp = /initial_interval not in intervals/;
    const actValue = App.initialize('qunit-fixture', _fetchData, true, optionsCopy);
    assert.true(regExp.test(actValue));
});


test('initial_target_var in target_variables values', assert => {
    const optionsCopy = structuredClone(covid19ForecastsVizTestOptions);
    optionsCopy['initial_target_var'] = "not in target_variables";

    const regExp = /initial_target_var not in target_variables/;
    const actValue = App.initialize('qunit-fixture', _fetchData, true, optionsCopy);
    assert.true(regExp.test(actValue));
});


test('initial_task_ids in task_ids value', assert => {
    const optionsCopy = structuredClone(covid19ForecastsVizTestOptions);
    optionsCopy['initial_task_ids'] = {"key not in task_ids": null};

    let regExp = /initial_task_ids key !== task_ids/;
    let actValue = App.initialize('qunit-fixture', _fetchData, true, optionsCopy);
    assert.true(regExp.test(actValue));

    optionsCopy['initial_task_ids'] = {"unit": "value not in task_ids"};
    regExp = /initial_task_ids value not in task_ids/;
    actValue = App.initialize('qunit-fixture', _fetchData, true, optionsCopy);
    assert.true(regExp.test(actValue));
});
