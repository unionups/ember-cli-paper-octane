'use strict';

const path = require('path');
const resolve = require('resolve');
const BroccoliMergeTrees = require('broccoli-merge-trees');
const writeFile = require('broccoli-file-creator');
const Funnel = require('broccoli-funnel');
const AngularScssFilter = require('./lib/angular-scss-filter');

const componentDependencies = {
  'icon': {
    styles: [
      'components/icon/icon.scss',
      'components/icon/icon-theme.scss'
    ]
  },
  'button': {
    styles: [
      'components/button/button.scss',
      'components/button/button-theme.scss'
    ]
  },
  'speed-dial': {
    styles: [
      'components/fabSpeedDial/fabSpeedDial.scss'
    ],
    dependencies: [
      'speed-dial/trigger',
      'speed-dial/action',
      'speed-dial/wrapper'
    ]
  },
};

module.exports = {
  name: require('./package').name,
  options: {
    polyfills: {
      'polyfill-nodelist-foreach': {
        files: ['index.js'],
        // compatibility from https://developer.mozilla.org/en-US/docs/Web/API/NodeList/forEach
        browsers: ['ie > 0', 'chrome < 52', 'ff < 50', 'opera < 38', 'safari < 10', 'edge < 16', 'android < 51', 'and_chr < 51', 'and_ff < 50', 'ios_saf < 10', 'Samsung < 5']
      },
      'classlist-polyfill': {
        files: ['src/index.js'],
        caniuse: 'classlist'
      },
      'element-closest': {
        files: ['browser.js'],
        caniuse: 'element-closest'
      },
      'matchmedia-polyfill': {
        files: ['matchMedia.js'],
        caniuse: 'matchmedia'
      }
    }
  },

  included() {
    this._super.included.apply(this, arguments);
    let app = this._findHost();
    this.emberCliPaperOctaneOptions = Object.assign({}, app.options['ember-cli-paper-octane']);
  },

  config() {
    return {
      'ember-cli-paper-octane': {
        insertFontLinks: true
      }
    };
  },

  contentFor(type, config) {

    if (type === 'head') {

      if (config['ember-cli-paper-octane'].insertFontLinks) {

        let whitelist = this.emberCliPaperOctaneOptions.whitelist || [];
        let blacklist = this.emberCliPaperOctaneOptions.blacklist || [];

        let links = '<link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Roboto:300,400,500,700,800,400italic">';

        let paperIconNotWhitelisted = whitelist.length && !whitelist.includes('icon');
        let paperIconBlacklisted = blacklist.length && blacklist.includes('icon');

        if (paperIconNotWhitelisted || paperIconBlacklisted) {
          return links;
        }

        return `${links} <link rel="stylesheet" href="https://fonts.googleapis.com/icon?family=Material+Icons">`;

      }
    }
  },

  treeForVendor(tree) {
    let trees = [];

    // let versionTree = writeFile(
    //   'ember-paper/register-version.js',
    //   `Ember.libraries.register('Ember Paper', '${version}');`
    // );

    // let hammerJs = fastbootTransform(new Funnel(this.pathBase('hammerjs'), {
    //   files: ['hammer.js'],
    //   destDir: 'hammerjs'
    // }));

    // let propagatingHammerJs = fastbootTransform(new Funnel(this.pathBase('propagating-hammerjs'), {
    //   files: ['propagating.js'],
    //   destDir: 'propagating-hammerjs'
    // }));

    // trees = trees.concat([hammerJs, propagatingHammerJs, versionTree]);

    if (tree) {
      trees.push(tree);
    }

    return new BroccoliMergeTrees(trees);
  },

  treeForStyles(tree) {
    
    let coreScssFiles = [
      // core styles
      'core/style/mixins.scss',
      'core/style/variables.scss',
      'core/style/structure.scss',
      'core/style/typography.scss',
      'core/style/layout.scss',
      'core/services/layout/layout.scss',

      // TODO: Move to core, if we don't import menu, it breaks.
      'components/menu/menu.scss',
      'components/menu/menu-theme.scss',

      // Need to find which components rely on this, otherwise, move to core.
      'components/whiteframe/whiteframe.scss',

      'components/panel/panel.scss',
      'components/panel/panel-theme.scss'
    ];

    let filteredScssFiles = this.addStyles(coreScssFiles) || coreScssFiles;

    let angularScssFiles = new Funnel(this.pathBase('angular-material-styles'), {
      files: filteredScssFiles,
      srcDir: '/src',
      destDir: 'angular-material',
      annotation: 'AngularScssFunnel'
    });

    angularScssFiles = new AngularScssFilter(angularScssFiles);
    

    let importer = writeFile(
      'ember-cli-paper-octane-components.scss',
      filteredScssFiles.map((path) => `@import './angular-material/${path}';`).join('\n')
    );

    let mergedTrees = new BroccoliMergeTrees([angularScssFiles, importer, tree], { overwrite: true });
    return this._super.treeForStyles(mergedTrees);
  },

  /*
    Rely on the `resolve` package to mimic node's resolve algorithm.
    It finds the angular-material-source module in a manner that works for npm 2.x,
    3.x, and yarn in both the addon itself and projects that depend on this addon.

    This is an edge case b/c angular-material-source does not have a main
    module we can require.resolve through node itself and similarily ember-cli
    does not have such a hack for the same reason.

    tl;dr - We want the non built scss files, and b/c this dep is only provided via
    git, we use this hack. Please change it if you read this and know a better way.
  */
  pathBase(packageName) {
    return path.dirname(resolve.sync(`${packageName}/package.json`, { basedir: __dirname }));
  },

  treeForApp(tree) {
    tree = this.filterComponents(tree);
    return this._super.treeForApp.call(this, tree);
  },

  treeForAddon(tree) {
    tree = this.filterComponents(tree);
    return this._super.treeForAddon.call(this, tree);
  },

  // treeForAddonTemplates(tree) {
  //   tree = this.filterComponents(tree);
  //   return this._super.treeForAddonTemplates.call(this, tree);
  // },

  /**
   * This function will push styles using whitelist and blacklist
   * @param {Array} core - The core scss files
   * @return {Array} - New array with styles appended
   */
  addStyles(core = []) {

    let whitelist = this.generateWhitelist(this.emberCliPaperOctaneOptions.whitelist);
    let blacklist = this.emberCliPaperOctaneOptions.blacklist || [];

    let styles = core.slice();

    // add everything if no opts defined
    if (whitelist.length === 0 && blacklist.length === 0) {
      Object.keys(componentDependencies).forEach((key) => {
        this.addComponentStyle(styles, componentDependencies[key]);
      });
    }

    // build array from whitelist
    if (whitelist.length && blacklist.length === 0) {
      whitelist.forEach((component) => {
        this.addComponentStyle(styles, componentDependencies[component]);
      });
    }

    // add all but blacklisted
    if (blacklist.length && whitelist.length === 0) {
      Object.keys(componentDependencies).forEach((key) => {
        if (!blacklist.includes(key)) {
          this.addComponentStyle(styles, componentDependencies[key]);
        }
      });
    }

    return styles;

  },

  /**
   * Validate if the object exists in componentDependencies and has any styles
   * if so, add them to the arr
   *
   * @param {Array} arr - Styles array
   * @param {Object} component - componentDependencies[key]
   */
  addComponentStyle(arr, component) {
    if (component && component.styles) {
      component.styles.forEach((scss) => {
        if (!arr.includes(scss)) {
          arr.push(scss);
        }
      });
    }

  },

  filterComponents(tree) {
    let whitelist = this.generateWhitelist(this.emberCliPaperOctaneOptions.whitelist);
    let blacklist = this.emberCliPaperOctaneOptions.blacklist || [];

    // exit early if no opts defined
    if (whitelist.length === 0 && blacklist.length === 0) {
      return tree;
    }

    return new Funnel(tree, {
      exclude: [(name) => this.excludeComponent(name, whitelist, blacklist)]

    });
  },

  excludeComponent(name, whitelist, blacklist) {
    let regex = /^(templates\/)?components\/(base\/)?/;
    let isComponent = regex.test(name);
    if (!isComponent) {
      return false;
    }

    let baseName = name.replace(regex, '');
    baseName = baseName.replace(/(\/component|\/template\b)/, '');
    baseName = baseName.substring(0, baseName.lastIndexOf('.')); 
 
    let isWhitelisted = whitelist.indexOf(baseName) !== -1;
    let isBlacklisted = blacklist.indexOf(baseName) !== -1;

    if (whitelist.length === 0 && blacklist.length === 0) {
      return false;
    }

    if (whitelist.length && blacklist.length === 0) {
      return !isWhitelisted;
    }

    return isBlacklisted;
  },

  generateWhitelist(whitelist) {
    let list = [];

    if (!whitelist) {
      return list;
    }

    function _addToWhitelist(item) {
      if (list.indexOf(item) === -1) {
        list.push(item);

        if (componentDependencies[item] && componentDependencies[item].dependencies) {
          componentDependencies[item].dependencies.forEach(_addToWhitelist);
        }
      }
    }

    whitelist.forEach(_addToWhitelist);
    return list;
  }
};
