// @ts-check

const fs = require('fs');
const path = require('path');
const { languages } = require('./languages');

const mainLanguages = [
    {
        name: 'fsharp',
        targetScopes: [
            'source.fsharp',
            'source.fsharp.fsi',
            'source.fsharp.fsx',
            'source.fsharp.fsl'
        ],
        basicGrammarPattern: {
            begin: x => `(?i)(\\*\\s*\\b(?:${x})\\b\\s*\\*\\))\\s*(""")`,
            beginCaptures: {
                1: { name: 'comment.block.fsharp' },
                2: { name: 'punctuation.definition.string.begin.fsharp' }
            },
            end: `(?=""")`
        },
        basicGrammar: {
            begin: x => `(?i)(\\()(?=(\\*\\s*\\b(?:${x})\\b\\s*\\*\\))\\s*""")`,
            beginCaptures: {
                1: { name: 'comment.block.fsharp' }
            },
            end: '(""")',
            endCaptures: {
                0: { name: 'string.quoted.double.fsharp' },
                1: { name: 'punctuation.definition.string.end.fsharp' }
            },
        }
    },
    {
        name: 'javascript',
        targetScopes: ['source.js', 'source.jsx', 'source.js.jsx', 'source.ts', 'source.tsx'],
        basicGrammarPattern: {
            begin: x => `(?i)(\\*\\s*\\b(?:${x})\\b\\s*\\*/)\\s*(\`)`,
            beginCaptures: {
                1: { name: 'comment.block.ts' },
                2: { name: 'punctuation.definition.string.template.begin.js' }
            },
            end: '(?=`)'
        },
        basicGrammar: {
            begin: x => `(?i)(/)(?=(\\*\\s*\\b(?:${x})\\b\\s*\\*/)\\s*\`)`,
            beginCaptures: {
                1: { name: 'comment.block.ts' }
            },
            end: '(`)',
            endCaptures: {
                0: { name: 'string.js' },
                1: { name: 'punctuation.definition.string.template.end.js' }
            },
        }
    }
]

function basicGrammarTemplate(mainLanguage) {
    return {
        "fileTypes": [],
        "injectionSelector": getBasicGrammarInjectionSelector(mainLanguage),
        "patterns": [],
        "scopeName": `inline.${mainLanguage.name}.template-tagged-languages`
    }
};

function reinjectGrammarTemplate(mainLanguage) {
    return {
        "fileTypes": [],
        "injectionSelector": getReinjectGrammarInjectionSelector(mainLanguage),
        "patterns": [
            {
                "include": "source.ts#template-substitution-element"
            }
        ],
        "scopeName": `inline.${mainLanguage.name}.template-tagged-languages.reinjection`
    }
};

const getBasicGrammarPattern = (mainLanguage, language) => {
    const sources = Array.isArray(language.source) ? language.source : [language.source];
    return {
        name: `string.js.taggedTemplate.commentTaggedTemplate.${language.name}`,
        contentName: `meta.embedded.block.${language.name}`,

        // The leading '/' was consumed by outer rule
        begin: mainLanguage.basicGrammarPattern.begin(language.identifiers.map(escapeRegExp).join('|')),
        beginCaptures: mainLanguage.basicGrammarPattern.beginCaptures,
        end: mainLanguage.basicGrammarPattern.end,
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

const getBasicGrammar = mainLanguage => {
    const basicGrammar = basicGrammarTemplate(mainLanguage);

    basicGrammar.repository = languages.reduce((repository, language) => {
        repository[getRepositoryName(language)] = getBasicGrammarPattern(mainLanguage, language);
        return repository;
    }, {});

    // @ts-ignore
    const allLanguageIdentifiers = [].concat(...languages.map(x => x.identifiers));
    basicGrammar.patterns = [
        // @ts-ignore
        {
            // Match entire language comment identifier but only consume '/'
            begin: mainLanguage.basicGrammar.begin(allLanguageIdentifiers.map(escapeRegExp).join('|')),
            beginCaptures: mainLanguage.basicGrammar.beginCaptures,
            end: mainLanguage.basicGrammar.end,
            endCaptures: mainLanguage.basicGrammar.endCaptures,
            patterns: languages.map(language => ({ include: '#' + getRepositoryName(language) }))
        }
    ]

    return basicGrammar;
};

function getRepositoryName(langauge) {
    return 'commentTaggedTemplate-' + langauge.name;
}

function getBasicGrammarInjectionSelector(mainLanguage) {
    return mainLanguage.targetScopes
        .map(scope => `L:${scope} -comment -(string - meta.embedded)`)
        .join(', ');
}

function getReinjectGrammarInjectionSelector(mainLanguage) {
    return mainLanguage.targetScopes
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
    mainLanguages.forEach(mainLanguage => {
        writeJson(path.join(outDir, `grammar-${mainLanguage.name}.json`), getBasicGrammar(mainLanguage));
        writeJson(
            path.join(outDir, `reinject-grammar-${mainLanguage.name}.json`),
            reinjectGrammarTemplate(mainLanguage));
    });

};

