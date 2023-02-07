import flask
from flask import Flask

import time
import os, os.path
import filelock
import subprocess

import numpy as np

from analysis.data import DataDirCollection

from analysis.simulation.signal import Run2_PNBonded
from analysis.simulation.signal.util import charge


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

sources = [source for source in sources if not source.startswith('# ')]

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

@app.route("/show/simulation")
def simulation():
    return flask.render_template('simulation.html')

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

@app.route("/dataset/<dataset>/log")
def showLog(dataset):
    scan = cache.get().scan(dataset)
    if scan is None:
        flask.abort(404)

    return {'log': scan.log() }

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

def getCurveData(dataset, id):
    scan = cache.get().scan(dataset)
    if scan is None:
        flask.abort(404)

    try:
        # We hardcode only return curve 0 for now
        data = scan.get(id).curve(0)
    except Exception as e:
        print(e)
        flask.abort(404)

    return data


@app.route("/dataset/<dataset>/<int:id>")
def getCurve(dataset, id):
    data = getCurveData(dataset, id)

    return {
        'time': list(data[0, :]*1e9),
        'amplitude': list(data[1, :]*1e3),
    }


def runSimulation(type, Vbias, Na, Neh, pos, C):
    sim = Run2_PNBonded.createChargePropagationSimulation(Vbias, Na=Na)

    if type == 'p-red':
        # From absorption coef of wavelength of 660nm: https://refractiveindex.info/?shelf=main&book=Si&page=Aspnes
        charges = charge.exponential(Neh, -503e-6, 3.4148e-6)
    elif type == 'p-alpha':
        # Based on fit to TRIM simulation (using pybragg)
        # For Am-241 alpha in default config: pos ~ -503e-6 + 20.5e-6
        # Neh allows to scale amplitude easily
        charges = charge.alpha(Neh, pos, surface=-503e-6)
    else: # 'edge-ir'
        charges = charge.normal(Neh, pos, 10.7e-6)

    total = sim.run(charges, retEH=False)
    total = total.resample(50e-12)

    R = 50
    fc = 1/(2*np.pi*C*R)
    gain = 50*(10**(53/20))
    return total.filterLowPass(fc, gain)

@app.route("/simulation/compare/<dataset>/<int:id>")
def compareSimulation(dataset, id):
    t_start = time.time()

    TYPES = ['edge-ir', 'p-red', 'p-alpha']

    # Set default parameters
    param = {
        # Data Parameters
        'T0': 18.15e-9,         # s
        'offset': -12e-3,        # V

        # Simulation Parameters
        'type': TYPES[0],        # Default: 'edge-ir'
        'Na': 7e17,             # m⁻³
        'Vbias': 200.0,           # V
        'C': 23e-12,            # F
        'Neh': 8e5,             # [-]
        'Laser': -200e-6        # m
    }

    ## Probably handle this in the frontend!
    # factors = {
    #     'T0': 1e-9,             # ns -> s
    #     'offset': 1e-3,         # mV -> V
    #     'Na': 1e6,              # cm⁻³ -> m⁻³
    #     'VBias': 1,
    #     'C': 1e-12,             # pF -> F
    #     'Neh': 1,
    #     'Laser': 1e-6           # um -> m
    # }

    # Get parameters from request
    for key in param:
        if type(param[key]) == float or type(param[key]) == int:
            param[key] = flask.request.args.get(key, default=param[key], type=float)
        else:
            param[key] = flask.request.args.get(key, default=param[key], type=str)

    if param['type'] not in TYPES:
        param['type'] = TYPES[0]

    # Get the curve data
    data = getCurveData(dataset, id)

    data_time = data[0, :]
    amplitude = data[1, :]

    # Apply T0 and offset to data
    data_time -= param['T0']
    amplitude -= param['offset']

    # Run simulation
    total = runSimulation(param['type'], param['Vbias'], param['Na'], param['Neh'], param['Laser'], param['C'])

    # Calculate difference
    data_start = np.argmax(data_time >= total.time()[0])

    # Calculate maximum number of simulation sample to use
    n_sim = len(total.time())
    if data_start + n_sim > len(amplitude):
        n_sim = len(amplitude) - data_start

    data_sel = range(data_start, data_start+n_sim)

    sim_amplitude = np.zeros(amplitude.shape)
    sim_amplitude[data_sel] = -1*total.signal()[0:n_sim]

    difference = amplitude - sim_amplitude

    t_stop = time.time()

    print('Total', f'{(t_stop - t_start)*1e3:.0f} ms')

    return {
        'time': list(data_time*1e9),
        'data': list(amplitude*1e3),
        'simulation': list(sim_amplitude*1e3),
        'difference': list(difference*1e3),
        'integral': {
            'data': np.trapz(amplitude, data_time)*1e9,
            'simulation': np.trapz(sim_amplitude, data_time)*1e9,
            'difference': np.trapz(difference, data_time)*1e9,
        },
        'meta': {
            'parameter': param,
            '_time': t_stop - t_start
        }
    }
