import './stubs.js'
import App from '../src/predtimechart.js';
import {getOptionsFromURL} from '../src/utils.js';

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


// prevent navigation from rewriting window.location: jsdom's default "about:blank" has no origin to build a URL from,
// and a replaceState() here would leak the new URL into the other test files' initialize() calls
App.showOptionsInURL = function (...args) {
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


//
// season mode UI tests
//

QUnit.module('season mode UI');


// initializes App with `available_as_ofs` spanning the 2020-2021 and 2021-2022 seasons, and with `ploty_div` ready for
// showOptionsInURL()
function initializeTwoSeasons() {
    const optionsCopy = structuredClone(covid19ForecastsVizTestOptions);
    optionsCopy['available_as_ofs'] = {"week_ahead_incident_deaths": ["2021-06-04", "2022-01-22", "2022-01-29"]};
    App.initialize('qunit-fixture', _fetchData, true, optionsCopy);
    document.getElementById('ploty_div').data = [];  // ala Plotly before the first plot
    return optionsCopy;
}


// sets the "Season mode (beta)" checkbox and fires its change handler
function setSeasonMode(isSeasonMode) {
    $("#forecastViz_season_mode").prop('checked', isSeasonMode).trigger('change');
}


// NB: jQuery's ':visible' is always false under jsdom, which has no layout, so we check the inline style that
// jQuery's toggle() sets instead
function isDisplayed(eleId) {
    return document.getElementById(eleId).style.display !== 'none';
}


test('initialize() creates the season mode controls, which start hidden', assert => {
    initializeTwoSeasons();
    ["forecastViz_season_mode", "season", "season_start"].forEach((eleId) => {
        assert.true(document.getElementById(eleId) !== null, eleId);
    });

    assert.false($("#forecastViz_season_mode").prop('checked'), 'season mode is off by default');
    assert.false(App.state.is_season_mode);
    assert.false(isDisplayed('forecastViz_season_controls'), 'the two SELECTs are hidden');
    assert.false(isDisplayed('forecastViz_other_seasons_row'), '"Other seasons" is hidden');
});


test('the "Season start" SELECT offers the 12 months, defaulting to August', assert => {
    initializeTwoSeasons();
    const monthTexts = $("#season_start option").map((idx, ele) => $(ele).text()).get();
    assert.equal(monthTexts.length, 12);
    assert.equal(monthTexts[0], 'January');
    assert.equal(monthTexts[11], 'December');
    assert.equal($("#season_start").val(), '8', 'August');
    assert.equal(App.state.season_start_month, 8);
});


test('the "Season" SELECT offers the seasons in available_as_ofs, newest first', assert => {
    initializeTwoSeasons();
    assert.deepEqual($("#season option").map((idx, ele) => $(ele).text()).get(), ['2021-2022', '2020-2021']);
    assert.equal($("#season").val(), '2021', 'the initial as_of date\'s season is selected');
    assert.equal(App.state.selected_season_start_year, 2021);
});


test('the "Season" SELECT follows the "Season start" SELECT', assert => {
    initializeTwoSeasons();
    $("#season_start").val('1').trigger('change');  // January -> a season is a single calendar year

    assert.equal(App.state.season_start_month, 1);
    assert.deepEqual($("#season option").map((idx, ele) => $(ele).text()).get(), ['2022', '2021'],
        'single-year season names');
    assert.equal(App.state.selected_season_start_year, 2022, '2022-01-29 is in the 2022 season');
});


test('turning season mode on shows the season controls and relabels the truth checkboxes', assert => {
    initializeTwoSeasons();

    // case: off (the default)
    assert.equal($("#asOfTruthDate").text(), 'As of data 2022-01-29');
    assert.equal($("#currentTruthDate").text(), 'Current data (2022-01-29)');

    // case: on
    setSeasonMode(true);
    assert.true(App.state.is_season_mode);
    assert.true(isDisplayed('forecastViz_season_controls'));
    assert.true(isDisplayed('forecastViz_other_seasons_row'));
    assert.equal($("#asOfTruthDate").text(), 'Selected season, as of data 2022-01-29');
    assert.equal($("#currentTruthDate").text(), 'Selected season, current data (2022-01-29)');

    // case: back off
    setSeasonMode(false);
    assert.false(App.state.is_season_mode);
    assert.false(isDisplayed('forecastViz_season_controls'));
    assert.false(isDisplayed('forecastViz_other_seasons_row'));
    assert.equal($("#asOfTruthDate").text(), 'As of data 2022-01-29');
    assert.equal($("#currentTruthDate").text(), 'Current data (2022-01-29)');
});


test('left/right navigation stops at the selected season\'s boundary', assert => {
    initializeTwoSeasons();
    setSeasonMode(true);  // season 2021-2022 -> as_ofs 2022-01-22 and 2022-01-29

    App.decrementAsOf();
    assert.equal(App.state.selected_as_of_date, '2022-01-22');
    assert.true($("#decrement_as_of").prop('disabled'), 'the season\'s first as_of');

    App.decrementAsOf();
    assert.equal(App.state.selected_as_of_date, '2022-01-22', '2021-06-04 is in the previous season, so we stay put');

    App.incrementAsOf();
    assert.equal(App.state.selected_as_of_date, '2022-01-29');
    assert.true($("#increment_as_of").prop('disabled'), 'at the season\'s last as_of');

    App.incrementAsOf();
    assert.equal(App.state.selected_as_of_date, '2022-01-29');
});


test('left/right navigation is unrestricted when not in season mode', assert => {
    initializeTwoSeasons();

    App.decrementAsOf();
    App.decrementAsOf();
    assert.equal(App.state.selected_as_of_date, '2021-06-04', 'crossing the season boundary is fine');
    assert.false($("#decrement_as_of").prop('disabled'), 'the buttons are never disabled outside season mode');
    assert.false($("#increment_as_of").prop('disabled'));
});


test('selecting a season moves to that season\'s last as_of date', assert => {
    initializeTwoSeasons();
    setSeasonMode(true);

    $("#season").val('2020').trigger('change');
    assert.equal(App.state.selected_season_start_year, 2020);
    assert.equal(App.state.selected_as_of_date, '2021-06-04', 'the only as_of in the 2020-2021 season');
    assert.equal($("#asOfTruthDate").text(), 'Selected season, as of data 2021-06-04');
    assert.true($("#decrement_as_of").prop('disabled'), 'a one-as_of season has nowhere to navigate');
    assert.true($("#increment_as_of").prop('disabled'));
});


test('initialize() honors initial_season_mode and initial_season_start_month', assert => {
    const optionsCopy = structuredClone(covid19ForecastsVizTestOptions);
    optionsCopy['available_as_ofs'] = {"week_ahead_incident_deaths": ["2021-06-04", "2022-01-22", "2022-01-29"]};
    optionsCopy['initial_season_mode'] = true;
    optionsCopy['initial_season_start_month'] = 1;  // January -> a season is a single calendar year
    App.initialize('qunit-fixture', _fetchData, true, optionsCopy);

    assert.true(App.state.is_season_mode);
    assert.true($("#forecastViz_season_mode").prop('checked'), 'the checkbox matches the state');
    assert.true(isDisplayed('forecastViz_season_controls'));
    assert.true(isDisplayed('forecastViz_other_seasons_row'));
    assert.equal(App.state.season_start_month, 1);
    assert.equal($("#season_start").val(), '1');
    assert.deepEqual($("#season option").map((idx, ele) => $(ele).text()).get(), ['2022', '2021'],
        'single-year season names');
    assert.equal(App.state.selected_season_start_year, 2022, 'the initial as_of date\'s season');
    assert.equal(App.state.selected_as_of_date, '2022-01-29', 'the as_of date is untouched');
});


test('initialize() honors initial_season, moving to that season\'s first as_of date', assert => {
    const optionsCopy = structuredClone(covid19ForecastsVizTestOptions);
    optionsCopy['available_as_ofs'] = {"week_ahead_incident_deaths": ["2021-06-04", "2022-01-22", "2022-01-29"]};
    optionsCopy['initial_season_mode'] = true;
    optionsCopy['initial_season'] = 2021;  // the season initial_as_of is already in
    App.initialize('qunit-fixture', _fetchData, true, optionsCopy);

    assert.equal(App.state.selected_season_start_year, 2021);
    assert.equal(App.state.selected_as_of_date, '2022-01-22', 'the 2021-2022 season\'s first as_of date');
    assert.equal($("#season").val(), '2021');

    // case: a season other than initial_as_of's
    optionsCopy['initial_season'] = 2020;
    App.initialize('qunit-fixture', _fetchData, true, optionsCopy);
    assert.equal(App.state.selected_season_start_year, 2020);
    assert.equal(App.state.selected_as_of_date, '2021-06-04', 'the only as_of in the 2020-2021 season');
});


test('initial_season is ignored when season mode is off', assert => {
    const optionsCopy = structuredClone(covid19ForecastsVizTestOptions);
    optionsCopy['available_as_ofs'] = {"week_ahead_incident_deaths": ["2021-06-04", "2022-01-22", "2022-01-29"]};
    optionsCopy['initial_season'] = 2020;  // NB: no initial_season_mode
    App.initialize('qunit-fixture', _fetchData, true, optionsCopy);

    assert.false(App.state.is_season_mode);
    assert.equal(App.state.selected_as_of_date, '2022-01-29', 'the as_of date is untouched');
    assert.equal(App.state.selected_season_start_year, 2021, 'the season is derived from the as_of date');
});


//
// optionsURL() tests
//

QUnit.module('optionsURL()');


test('optionsURL() includes the season params only when season mode is on', assert => {
    initializeTwoSeasons();

    // case: season mode off -> no season params at all
    let searchParams = App.optionsURL().searchParams;
    assert.false(searchParams.has('season_mode'));
    assert.false(searchParams.has('season'));
    assert.false(searchParams.has('season_start'));
    assert.equal(searchParams.get('as_of'), '2022-01-29', 'the non-season params are unchanged');
    assert.equal(searchParams.get('target_var'), 'week_ahead_incident_deaths');

    // case: season mode on
    setSeasonMode(true);
    searchParams = App.optionsURL().searchParams;
    assert.equal(searchParams.get('season_mode'), 'true');
    assert.equal(searchParams.get('season'), '2021');
    assert.equal(searchParams.get('season_start'), '8');

    // case: the "Season start" SELECT is captured too
    $("#season_start").val('1').trigger('change');
    searchParams = App.optionsURL().searchParams;
    assert.equal(searchParams.get('season_start'), '1');
    assert.equal(searchParams.get('season'), '2022', 'January start -> 2022-01-29 is in the 2022 season');

    // case: back off -> the season params go away again
    setSeasonMode(false);
    assert.false(App.optionsURL().searchParams.has('season_mode'));
});


test('optionsURL() season params round-trip through getOptionsFromURL()', assert => {
    initializeTwoSeasons();
    setSeasonMode(true);
    $("#season").val('2020').trigger('change');

    const urlOptions = getOptionsFromURL(App.state.task_ids, App.optionsURL().search);
    assert.equal(urlOptions['initial_season_mode'], true);
    assert.equal(urlOptions['initial_season'], 2020);
    assert.equal(urlOptions['initial_season_start_month'], 8);
    assert.equal(urlOptions['initial_as_of'], App.state.selected_as_of_date);
});


test('initialize() picks the season params up from window.location', assert => {
    const optionsCopy = structuredClone(covid19ForecastsVizTestOptions);
    optionsCopy['available_as_ofs'] = {"week_ahead_incident_deaths": ["2021-06-04", "2022-01-22", "2022-01-29"]};

    // NB: replaceState() rather than a stub b/c initialize() reads `window.location.search` itself. we put it back
    // afterwards so that the other tests (and files) still see a bare URL
    const origUrl = window.location.href;
    try {
        window.history.replaceState(null, '', '?season_mode=true&season=2020&season_start=8');
        App.initialize('qunit-fixture', _fetchData, true, optionsCopy);

        assert.true(App.state.is_season_mode, 'season mode came from the URL');
        assert.true($("#forecastViz_season_mode").prop('checked'));
        assert.equal(App.state.season_start_month, 8);
        assert.equal(App.state.selected_season_start_year, 2020);
        assert.equal(App.state.selected_as_of_date, '2021-06-04',
            'no as_of in the URL -> the season wins and we move to its first as_of date');

        // case: an as_of in the URL is more specific, so it wins and the season is derived from it
        window.history.replaceState(null, '', '?season_mode=true&season=2020&season_start=8&as_of=2022-01-29');
        App.initialize('qunit-fixture', _fetchData, true, optionsCopy);
        assert.equal(App.state.selected_as_of_date, '2022-01-29');
        assert.equal(App.state.selected_season_start_year, 2021, 'the season of the URL\'s as_of date');
    } finally {
        window.history.replaceState(null, '', origUrl);
    }
});
