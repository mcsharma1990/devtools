var React = require('react');
var ReactDOM = require('react-dom');
var URI = require('urijs');
var $ = require('jquery');

var RootUI = React.createClass({

    getInitialState: function () {
        return {
            cardText: "",
            cardX: 0,
            cardY: 0
        };
    },

    _getRowMarkup: function (leftMarkup, rightMarkup) {
        if (typeof this.key == 'undefined') {
            this.key = 0;
        }
        return <tr key={this.key++}>
            <td className="leftPannel">{leftMarkup}</td>
            <td className="resultFileView">{rightMarkup}</td>
        </tr>
    },

    _onFileTypeChange: function (event) {
        var fileType = event.target.value;
        var uri = URI(window.location.href);
        if (fileType) {
            uri.setQuery("fileType", event.target.value);
        } else {
            uri.removeQuery("fileType");
        }
        window.location.href = uri;
    },

    _onCaseChange: function (event) {
        var cs = event.target.checked;
        var uri = URI(window.location.href);
        if (cs) {
            uri.setQuery("cs", 1);
        } else {
            uri.removeQuery("cs");
        }
        window.location.href = uri;
    },

    _onQueryChange: function (event) {
        if (event.keyCode != 13) {
            return;
        }
        var q = event.target.value;
        var uri = URI(window.location.href);
        if (q) {
            uri.setQuery("q", q);
            window.location.href = uri;
        }
    },

    _onMouseUp: function (event) {
        var text = window.getSelection().toString();
        var lines = 0;
        text.split("\n").forEach(function (line) {
            if (line != "") lines++
        });
        if (lines > 1) {
            // selected multiple line, we probably don't want to show hintCard 
            // in this case
            this.setState({cardText: ""});
            return;
        }
        this.setState({
            cardText: text,
            cardX: event.pageX + 5,
            cardY: event.pageY - (30 + 10) // Keep it same as the width of hintCard
        });
    },

    _getQueryUrl: function (q) {
        var uri = URI(window.location.href);
        uri.setQuery("q", q);
        return uri;
    },

    render: function () {
        var i = 0;
        var rawResults = this.props.data.results;
        var results = {};
        var count = 0;
        rawResults.forEach(function (result) {
            var parts = result.substr(26).split(":");
            // filter
            if (this.props.data.fileType &&
                !parts[0].endsWith("." + this.props.data.fileType)) {
                return;
            }
            count++;
            if (!results[parts[0]]) results[parts[0]] = {};
            results[parts[0]][parts[1]] = parts.slice(2).join(":");
        }.bind(this));
        var markups = [];
        for (var filePath in results) {
            if (!results.hasOwnProperty(filePath)) continue;
            var fileLink = this.props.data.prefix + filePath;
            var fileHref =
                fileLink + "$" +
                Object.keys(results[filePath]).join(","); // Phabricator will highlight these lines
            var mainRow = this._getRowMarkup(
                null,
                <a href={fileHref}>{filePath}</a>
            );
            markups.push(mainRow);
            for (var lineNum in results[filePath]) {
                if (!results[filePath].hasOwnProperty(lineNum)) continue;
                var line = results[filePath][lineNum];
                var highlightedLine = this._highlightQuery(
                    line,
                    this.props.data.q
                );
                var individualRow = this._getRowMarkup(
                    <a href={fileLink+"$"+lineNum}>{lineNum}</a>,
                    <div
                        dangerouslySetInnerHTML={{__html: highlightedLine}}></div>
                );
                markups.push(individualRow);
            }
            // Add an empty line.
            markups.push(this._getRowMarkup(null, <br />));
        }
        var resultsSummaryUI = null, searchResultTitleUI = null;
        if (this.props.data.q) {
            resultsSummaryUI = <span className="resultsCount">
                <strong>{count}</strong> results ({this.props.data.execTimeMs}ms)
            </span>;
            searchResultTitleUI =
                <div className="resultsTitle">Search Results:</div>;
        }

        var hintCard = null;
        if (this.state.cardText.trim()) {
            // Note that here we don't want to trim, because the search is
            // sensitive to leading/trailing whitespaces.
            var text = this.state.cardText;
            hintCard = <div
                className="hintCard code"
                style={{
                    left: this.state.cardX,
                    top: this.state.cardY,
                    width: Math.min(Math.max(200, text.length * 10), 500)}}>
                Search for:
                <div><a href={this._getQueryUrl(text)}>{text}</a></div>
            </div>
        }
        return (
            <div>
                {hintCard}
                <div className="topBar">
                    <input
                        className="query"
                        name="q"
                        defaultValue={this.props.data.q}
                        placeholder="Type text and hit enter"
                        onKeyDown={this._onQueryChange}/>
                    {resultsSummaryUI}
                    <span className="filters">
                        <span className="filter">File type:</span>
                        <select
                            className="fileTypeSelector"
                            name="fileType"
                            value={this.props.data.fileType}
                            onChange={this._onFileTypeChange}>
                            <option value="">all</option>
                            <option value="java">java</option>
                            <option value="cpp">cpp</option>
                            <option value="js">js</option>
                            <option value="go">go</option>
                        </select>
                        <span className="filter">Case sensitive:</span>
                        {this.props.data.cs ?
                            <input
                                type="checkbox"
                                name="cs"
                                onClick={this._onCaseChange}
                                defaultChecked="checked"
                            /> :
                            <input
                                type="checkbox"
                                name="cs"
                                onClick={this._onCaseChange}
                            />
                        }
                    </span>
                </div>
                {searchResultTitleUI}
                <table
                    className="code"
                    cellPadding="0"
                    cellSpacing="0"
                    onMouseUp={this._onMouseUp}>
                    <tbody>{markups}</tbody>
                </table>
            </div>
        );
    },

    _highlightQuery: function (text, query) {
        // chars that should be escaped
        // if we are using them in a regex want them to be treated as normal
        // characters.
        var charsToEscape = ".^$*+-?()[]{}\|";
        var regexSafeQuery = "";
        for (var i = 0; i < query.length; i++) {
            var c = query[i];
            if (charsToEscape.indexOf(c) !== -1) {
                regexSafeQuery += "\\";
            }
            regexSafeQuery += c;
        }
        console.log(regexSafeQuery);
        var regex = new RegExp("(" + regexSafeQuery + ")", "g"
            + (this.props.data.cs ? "" : "i"));
        return text.replace(regex, "<strong>$1</strong>");
    }

});

module.exports = RootUI;