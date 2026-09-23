import {
    closestYear,
    filterTruthToSeason,
    getOptionsFromURL,
    seasonDateRange,
    seasonName,
    seasonNameForDate,
    seasonsInDates,
    seasonStartYear,
    shiftDateStrByYears,
    splitTruthBySeason
} from '../src/utils.js';

const {test} = QUnit;


//
// utils tests
//

QUnit.module('utils');

test('closestYear()', assert => {
    const availableYears = ["2020-03-14", "2020-03-21", "2021-08-07", "2023-03-04", "2023-03-11"];
    const year_exp_closest_pairs = [   // cases:
        ["2020-03-13", "2020-03-14"],  // < first
        ["2020-03-14", "2020-03-14"],  // == first
        ["2021-08-06", "2021-08-07"],  // middle not ==
        ["2021-08-07", "2021-08-07"],  // middle ==
        ["2023-03-11", "2023-03-11"],  // == last
        ["2023-03-12", "2023-03-11"],  // > last
    ];
    year_exp_closest_pairs.forEach(year_exp_closest_pair => {
        const act_closest = closestYear(year_exp_closest_pair[0], availableYears);
        assert.deepEqual(act_closest, year_exp_closest_pair[1]);
    });
});


test('closestYear() is independent of the time zone', assert => {
    // regression: east of UTC, closestYear() used to return the day before the closest date, b/c it converted back to
    // a string via toISOString(), which is UTC. NB: Node picks up a change to process.env.TZ at runtime
    const availableYears = ["2022-01-22", "2022-01-29"];
    const origTZ = process.env.TZ;
    try {
        ['America/New_York', 'UTC', 'Europe/Berlin', 'Asia/Tokyo', 'Pacific/Auckland'].forEach(timeZone => {
            process.env.TZ = timeZone;
            assert.equal(closestYear("2022-01-24", availableYears), "2022-01-22", `${timeZone}: not ==`);
            assert.equal(closestYear("2022-01-29", availableYears), "2022-01-29", `${timeZone}: ==`);
        });
    } finally {
        if (origTZ === undefined) {
            delete process.env.TZ;
        } else {
            process.env.TZ = origTZ;
        }
    }
});


test('getOptionsFromURL()', assert => {
    const taskIDs = {  // fluMetrocastOptions['task_ids']
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
    };

    // case: blue sky
    let actOptions = getOptionsFromURL(taskIDs, '?target_var=ILI ED visits&location=NYC');
    let expOptions = {
        "initial_target_var": "ILI ED visits",
        "initial_task_ids": {
            "location": "NYC"
        },
    };
    assert.deepEqual(actOptions, expOptions);

    // case: "target_var" not present in URL -> no "initial_target_var" or "initial_task_ids" returned
    actOptions = getOptionsFromURL(taskIDs, '?location=NYC');
    expOptions = {};
    assert.deepEqual(actOptions, expOptions);

    // case: "target_var" present in URL, but value is not present in taskIDs -> no "initial_task_ids" returned
    actOptions = getOptionsFromURL(taskIDs, '?target_var=bad target var');
    expOptions = {
        "initial_target_var": "bad target var"
    };
    assert.deepEqual(actOptions, expOptions);
});


test('getOptionsFromURL() season params', assert => {
    const taskIDs = {};

    // case: all three present
    assert.deepEqual(getOptionsFromURL(taskIDs, '?season_mode=true&season=2024&season_start=1'), {
        "initial_season_mode": true,
        "initial_season": 2024,
        "initial_season_start_month": 1
    });

    // case: season_mode=false
    assert.deepEqual(getOptionsFromURL(taskIDs, '?season_mode=false'), {"initial_season_mode": false});

    // case: none present
    assert.deepEqual(getOptionsFromURL(taskIDs, '?as_of=2024-01-06'), {"initial_as_of": "2024-01-06"});

    // case: unparseable values are passed through unchanged so that schema validation rejects them. NB: parseInt()
    // alone would take '2024abc' as 2024 and '' as NaN
    assert.deepEqual(getOptionsFromURL(taskIDs, '?season_mode=yes&season=2024abc&season_start=not a month'), {
        "initial_season_mode": "yes",
        "initial_season": "2024abc",
        "initial_season_start_month": "not a month"
    });
});


//
// season tests. seasons run August 1 through July 31, e.g., season '2022-2023' is 2022-08-01 through 2023-07-31
//

QUnit.module('seasons');

test('seasonStartYear() and seasonNameForDate()', assert => {
    const date_exp_season_pairs = [        // cases:
        ["2022-08-01", "2022-2023"],       // first day of a season
        ["2022-09-03", "2022-2023"],       // fall
        ["2023-01-07", "2022-2023"],       // after the new year, same season
        ["2023-07-31", "2022-2023"],       // last day of that season
        ["2022-07-31", "2021-2022"],       // day before it starts -> previous season
        ["2020-02-29", "2019-2020"],       // leap day
    ];
    date_exp_season_pairs.forEach(date_exp_season_pair => {
        assert.equal(seasonNameForDate(date_exp_season_pair[0]), date_exp_season_pair[1], date_exp_season_pair[0]);
    });

    assert.equal(seasonStartYear("2022-08-01"), 2022);
    assert.equal(seasonStartYear("2022-07-31"), 2021);
});


test('shiftDateStrByYears()', assert => {
    assert.equal(shiftDateStrByYears("2020-12-26", 0), "2020-12-26");   // no-op
    assert.equal(shiftDateStrByYears("2020-12-26", 2), "2022-12-26");   // forward
    assert.equal(shiftDateStrByYears("2020-12-26", -1), "2019-12-26");  // backward
    assert.equal(shiftDateStrByYears("2024-02-29", 1), "2025-03-01");   // leap day rolls over
    assert.equal(shiftDateStrByYears("2024-02-29", 4), "2028-02-29");   // "" but target year is a leap year
});


test('splitTruthBySeason()', assert => {
    // case: two seasons, split at August 1
    const truthData = {
        "date": ["2020-12-26", "2021-01-02", "2021-07-31", "2021-08-01", "2021-09-04"],
        "y": [1, 2, 3, 4, 5]
    };
    assert.deepEqual(splitTruthBySeason(truthData), [
        {season: "2020-2021", startYear: 2020, date: ["2020-12-26", "2021-01-02", "2021-07-31"], y: [1, 2, 3]},
        {season: "2021-2022", startYear: 2021, date: ["2021-08-01", "2021-09-04"], y: [4, 5]},
    ]);

    // case: no data. NB: state.current_truth is initialized to [], not to an empty object
    assert.deepEqual(splitTruthBySeason({"date": [], "y": []}), []);
    assert.deepEqual(splitTruthBySeason([]), []);
    assert.deepEqual(splitTruthBySeason(undefined), []);
});


test('filterTruthToSeason()', assert => {
    const truthData = {
        "date": ["2020-12-26", "2021-01-02", "2021-07-31", "2021-08-01", "2021-09-04"],
        "y": [1, 2, 3, 4, 5]
    };

    assert.deepEqual(filterTruthToSeason(truthData, 2020),
        {date: ["2020-12-26", "2021-01-02", "2021-07-31"], y: [1, 2, 3]});
    assert.deepEqual(filterTruthToSeason(truthData, 2021), {date: ["2021-08-01", "2021-09-04"], y: [4, 5]});

    // case: no matching season, and no data at all
    assert.deepEqual(filterTruthToSeason(truthData, 2019), {date: [], y: []});
    assert.deepEqual(filterTruthToSeason([], 2021), {date: [], y: []});
    assert.deepEqual(filterTruthToSeason(undefined, 2021), {date: [], y: []});
});


test('seasonDateRange()', assert => {
    assert.deepEqual(seasonDateRange(2022), ['2022-08-01', '2023-07-31']);
    assert.deepEqual(seasonDateRange(2019), ['2019-08-01', '2020-07-31']);
});


//
// "Season start" tests: all of the above default to an August start, but the user can pick any month
//

QUnit.module('season start month');


test('seasonStartYear() honors the start month', assert => {
    // case: a March start -> a season runs March 1 through the end of the following February
    assert.equal(seasonStartYear("2022-03-01", 3), 2022);   // first day of a season
    assert.equal(seasonStartYear("2023-02-28", 3), 2022);   // last day of that season
    assert.equal(seasonStartYear("2022-02-28", 3), 2021);   // day before it starts -> previous season

    // case: a January start -> a season is a single calendar year
    assert.equal(seasonStartYear("2022-01-01", 1), 2022);
    assert.equal(seasonStartYear("2022-12-31", 1), 2022);

    // case: a December start -> a season is almost entirely in the following year
    assert.equal(seasonStartYear("2022-12-01", 12), 2022);
    assert.equal(seasonStartYear("2022-11-30", 12), 2021);

    // case: invalid or missing start months fall back to the August default
    [undefined, null, 0, 13, '8'].forEach((badStartMonth) => {
        assert.equal(seasonStartYear("2022-07-31", badStartMonth), 2021, `${badStartMonth}`);
    });
});


test('seasonName() and seasonNameForDate() honor the start month', assert => {
    // case: a January start -> a season spans one year and is named by it alone
    assert.equal(seasonName(2025, 1), '2025');
    assert.equal(seasonNameForDate("2025-06-15", 1), '2025');

    // case: any other start -> a season is named by the two years it spans
    assert.equal(seasonName(2025), '2025-2026');
    assert.equal(seasonName(2025, 3), '2025-2026');
    assert.equal(seasonNameForDate("2025-06-15", 3), '2025-2026', 'June is after a March start');
    assert.equal(seasonNameForDate("2025-02-15", 3), '2024-2025', 'February is before it');
});


test('seasonDateRange() honors the start month', assert => {
    assert.deepEqual(seasonDateRange(2022, 1), ['2022-01-01', '2022-12-31'], 'a January season is one calendar year');
    assert.deepEqual(seasonDateRange(2023, 3), ['2023-03-01', '2024-02-29'], 'ends on a leap day');
    assert.deepEqual(seasonDateRange(2022, 3), ['2022-03-01', '2023-02-28']);
    assert.deepEqual(seasonDateRange(2022, 12), ['2022-12-01', '2023-11-30']);
});


test('splitTruthBySeason() and filterTruthToSeason() honor the start month', assert => {
    const truthData = {
        "date": ["2020-12-26", "2021-01-02", "2021-07-31", "2021-08-01", "2021-09-04"],
        "y": [1, 2, 3, 4, 5]
    };

    // with a January start the August 1 boundary no longer splits anything: everything from 2021 is one season
    assert.deepEqual(splitTruthBySeason(truthData, 1), [
        {season: "2020", startYear: 2020, date: ["2020-12-26"], y: [1]},
        {season: "2021", startYear: 2021, date: ["2021-01-02", "2021-07-31", "2021-08-01", "2021-09-04"], y: [2, 3, 4, 5]},
    ]);
    assert.deepEqual(filterTruthToSeason(truthData, 2021, 1),
        {date: ["2021-01-02", "2021-07-31", "2021-08-01", "2021-09-04"], y: [2, 3, 4, 5]});
});


test('seasonsInDates()', assert => {
    const asOfs = ["2020-12-26", "2021-01-02", "2021-07-31", "2021-08-01", "2021-09-04"];
    assert.deepEqual(seasonsInDates(asOfs), [2020, 2021], 'unique and ascending');
    assert.deepEqual(seasonsInDates(asOfs, 1), [2020, 2021], 'a January start splits these two the same way');
    assert.deepEqual(seasonsInDates(["2021-09-04", "2020-12-26"]), [2020, 2021], 'input need not be sorted');

    // case: no data
    assert.deepEqual(seasonsInDates([]), []);
    assert.deepEqual(seasonsInDates(undefined), []);
});
