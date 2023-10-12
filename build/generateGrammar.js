// @ts-check

const fs = require('fs');
const path = require('path');
const { languages } = require('./languages');

const targetScopes = [
'source.fsharp',
'source.fsharp.fsi',
'source.fsharp.fsx',
'source.fsharp.fsl'
]

const basicGrammarTemplate = {
    "fileTypes": [],
    "injectionSelector": getBasicGrammarInjectionSelector(),
    "patterns": [],
    "scopeName": "inline.template-tagged-languages"
};

const reinjectGrammarTemplate = {
    "fileTypes": [],
    "injectionSelector": getReinjectGrammarInjectionSelector(),
    "patterns": [
        {
            "include": "source.ts#template-substitution-element"
        }
    ],
    "scopeName": "inline.template-tagged-languages.reinjection"
};

const getBasicGrammarPattern = (language) => {
    const sources = Array.isArray(language.source) ? language.source : [language.source];
    return {
        name: `string.js.taggedTemplate.commentTaggedTemplate.${language.name}`,
        contentName: `meta.embedded.block.${language.name}`,

        // The leading '/' was consumed by outer rule
        begin: `(?i)(\\*\\s*\\b(?:${language.identifiers.map(escapeRegExp).join('|')})\\b\\s*\\*\\))\\s*(""")`,
        beginCaptures: {
            1: { name: 'comment.block.fsharp' },
            2: { name: 'punctuation.definition.string.begin.fsharp' }
        },
        end: `(?=""")`,
        patterns: [
            ...sources.map(source => ({ 'include': source })),
            // When a language grammar is not installed, insert a phony pattern
            // so that we still match all the inner text but don't highlight it
            {
                match: "."
            }
        ]
    };
};

const getBasicGrammar = () => {
    const basicGrammar = basicGrammarTemplate;

    basicGrammar.repository = languages.reduce((repository, language) => {
        repository[getRepositoryName(language)] = getBasicGrammarPattern(language);
        return repository;
    }, {});

    // @ts-ignore
    const allLanguageIdentifiers = [].concat(...languages.map(x => x.identifiers));
    basicGrammar.patterns = [
        // @ts-ignore
        {
            // Match entire language comment identifier but only consume '/'
            begin: `(?i)(\\()(?=(\\*\\s*\\b(?:${allLanguageIdentifiers.map(escapeRegExp).join('|')})\\b\\s*\\*\\))\\s*""")`,
            beginCaptures: {
                1: { name: 'comment.block.fsharp' }
            },
            end: '(""")',
            endCaptures: {
                0: { name: 'string.quoted.double.fsharp' },
                1: { name: 'punctuation.definition.string.end.fsharp' }
            },
            patterns: languages.map(language => ({ include: '#' + getRepositoryName(language) }))
        }
    ]

    return basicGrammar;
};

function getRepositoryName(langauge) {
    return 'commentTaggedTemplate-' + langauge.name;
}

function getBasicGrammarInjectionSelector() {
    return targetScopes
        .map(scope => `L:${scope} -comment -(string - meta.embedded)`)
        .join(', ');
}

function getReinjectGrammarInjectionSelector() {
    return targetScopes
        .map(scope => {
            const embeddedScopeSelectors = languages.map(language => `meta.embedded.block.${language.name}`);
            return `L:${scope} (${embeddedScopeSelectors.join(', ')})`
        })
        .join(', ');
}

function escapeRegExp(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

function writeJson(outFile, json) {
    fs.writeFileSync(outFile, JSON.stringify(json, null, 4));
}

exports.updateGrammars = () => {
    const outDir = path.join(__dirname, '..', 'syntaxes');
    writeJson(path.join(outDir, 'grammar.json'), getBasicGrammar());

    writeJson(
        path.join(outDir, 'reinject-grammar.json'),
        reinjectGrammarTemplate);
};

