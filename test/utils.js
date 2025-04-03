import {closestYear, getOptionsFromURL} from '../src/utils.js';

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
