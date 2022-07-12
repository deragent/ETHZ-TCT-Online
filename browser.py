import flask
from flask import Flask

from analysis.data import DataDirCollection

# Load the data sources from the config file
with open('./sources.conf') as f:
    sources = f.read().splitlines()

dir = DataDirCollection(sources)

app = Flask(__name__)

def filterColumns(columns):
    HIDDEN_COLUMNS = [
      "Unnamed: 0",
      "time",
      "stage.status.",
      "amp.current",
      "bias.current",
      "temp.stage.temperature",
      "temp.holder.humidity",
      "temp.holder.temperature",
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
def home():
    return flask.render_template('home.html')

@app.route("/show/browser")
def browser():
    return flask.render_template('browser.html')

@app.route("/reload")
def reloadDatasets():
    dir.reload()

    return {}

@app.route("/dataset")
def listDatasets():
    return dir.scans().to_dict(orient='index')

@app.route("/dataset/<dataset>")
def listEntries(dataset):
    scan = dir.scan(dataset)
    if scan is None:
        flask.abort(404)
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
        flask.abort(404)

    try:
        # We hardcode only return curve 0 for now
        data = scan.get(id).curve(0)
    except Exception as e:
        print(e)
        flask.abort(404)

    return {
        'time': list(data[0, :]*1e9),
        'amplitude': list(data[1, :]*1e3),
    }
