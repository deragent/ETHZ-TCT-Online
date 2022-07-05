import flask
from flask import Flask

from analysis.data import DataDir

dir = DataDir('../_data/P301401/')

app = Flask(__name__)


def filterColumns(columns):
    HIDDEN_COLUMNS = [
      "Unnamed: 0",
      "time",
      "stage.status.",
      "amp.current",
      "bias.current",
    ]

    output = []
    for column in columns:
        for hidden in HIDDEN_COLUMNS:
            if column.startswith(hidden):
                break
        else:
            output.append(column)

    return output


@app.route("/")
def browser():
    return flask.render_template('browser.html')

@app.route("/reload")
def reloadDatasets():
    dir.reload()

@app.route("/dataset")
def listDatasets():
    return dir.scans().to_dict(orient='index')

@app.route("/dataset/<dataset>")
def listEntries(dataset):
    scan = dir.scan(dataset)
    if scan is None:
        return {}
    df = scan.list()

    changed = (df != df.iloc[0]).any()
    common = (df == df.iloc[0]).all()

    changed_columns = filterColumns(list(df.columns[changed]))
    changed_data = df[changed_columns]

    common_data = df.loc[0, common]

    return {
        'changed_columns': changed_columns,
        'changed_data': changed_data.to_dict(orient='index'),
        'common_data': common_data.to_dict(),
    }

@app.route("/dataset/<dataset>/<int:id>")
def getCurve(dataset, id):
    scan = dir.scan(dataset)
    if scan is None:
        return {}

    try:
        # We hardcode only return curve 0 for now
        data = scan.get(id).curve(0)
    except Exception as e:
        print(e)
        return {}

    return {
        'time': list(data[0, :]*1e9),
        'amplitude': list(data[1, :]*1e3),
    }
