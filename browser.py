import flask
from flask import Flask

import time
import os, os.path
import filelock
import subprocess

from analysis.data import DataDirCollection

class SyncCache():

    def __init__(self, obj):

        self._obj = obj
        self._obj_ts = -1

        self._ts_file = f'/tmp/tct-browser-cache-{os.getppid()}.ts'
        self._ts_file_lock = filelock.FileLock(self._ts_file + '.lock')

        with self._ts_file_lock:
            # Create the empty ts file if it does not exist
            if not os.path.exists(self._ts_file):
                with open(self._ts_file, 'w') as ts_file:
                    ts_file.write('-1')


    def _makeValid(self):
        valid = True
        with self._ts_file_lock:
            with open(self._ts_file, 'r') as ts_file:
                try:
                    ts = float(ts_file.read())

                    # If ts is newer than ours, we reload too
                    if ts > self._obj_ts:
                        print(f'{os.getpid()}: Not valid anymore: Reload!')

                        self._obj.reload()
                        self._obj_ts = ts

                except ValueError:
                    self._invalidateNoLock()

    def _invalidateNoLock(self):
        self._obj.reload()
        with open(self._ts_file, 'w') as ts_file:
            self._obj_ts = time.time()
            ts_file.write(f'{self._obj_ts}')

    def get(self):
        self._makeValid()

        return self._obj

    def reload(self):
        with self._ts_file_lock:
            print(f'{os.getpid()}: Reload requested!')
            self._invalidateNoLock()


# Load the data sources from the config file
with open('./sources.conf') as f:
    sources = f.read().splitlines()

cache = SyncCache(DataDirCollection(sources))

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
      "scope.amplitude",
      "amp.voltage",
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

@app.route("/show/overview")
def overview():
    return flask.render_template('overview.html')

@app.route("/reload")
def reloadDatasets():
    cache.reload()

    return {}

@app.route("/dataset")
def listDatasets():
    return cache.get().scans().to_dict(orient='index')

@app.route("/dataset/<dataset>")
def listEntries(dataset):
    scan = cache.get().scan(dataset)
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
        'info': scan.info(),
        'config_file': scan.configStr(),
    }

def datasetZipGenerator(folder):
    zip_proc = subprocess.Popen(
        ['zip', '-r', '-0', '-', folder.name],
        cwd=folder.parents[0],
        stdout=subprocess.PIPE, stderr=subprocess.DEVNULL
    )
    while True:
        buf = zip_proc.stdout.read(4096)
        if len(buf) == 0:
            break
        yield buf

@app.route("/dataset/<dataset>/download")
def downloadDataset(dataset):
    scan = cache.get().scan(dataset)
    if scan is None:
        flask.abort(404)

    response = flask.Response(flask.stream_with_context(datasetZipGenerator(scan.folder)), mimetype='application/zip')
    response.headers['Content-Disposition'] = f'attachment; filename={dataset}.zip'
    return response


@app.route("/dataset/<dataset>/plot")
def listPlots(dataset):
    scan = cache.get().scan(dataset)
    if scan is None:
        flask.abort(404)

    return {'plots': scan.plots()}

@app.route("/dataset/<dataset>/plot/<int:idx>")
def showPlot(dataset, idx):
    scan = cache.get().scan(dataset)
    if scan is None:
        flask.abort(404)

    plots = scan.plots()
    if idx < 0 or idx >= len(plots):
        flask.abort(404)

    return flask.send_file(scan.plotFile(plots[idx]))

@app.route("/dataset/<dataset>/<int:id>")
def getCurve(dataset, id):
    scan = cache.get().scan(dataset)
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
