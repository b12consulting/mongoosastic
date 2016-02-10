var mongoose = require('mongoose'),
    async = require('async'),
    config = require('./config'),
    Schema = mongoose.Schema,
    esResultText,
    mongoosastic = require('../lib/mongoosastic');

var esResultTextSchema = new Schema({
  title: String,
  quote: String
});

esResultTextSchema.plugin(mongoosastic);

esResultText = mongoose.model('esResultText', esResultTextSchema);

describe('Hydrate with ES data', function() {
  var responses = [
    'You don\'t see people at their best in this job, said <em>Death</em>.',
    'The <em>death</em> of the warrior or the old man or the little child, this I understand, and I take away the',
    ' pain and end the suffering. I do not understand this <em>death</em>-of-the-mind',
    'The only reason for walking into the jaws of <em>Death</em> is so\'s you can steal his gold teeth'
  ];

  before(function(done) {
    mongoose.connect(config.mongoUrl, function() {
      esResultText.remove(function() {
        config.deleteIndexIfExists(['esresulttexts'], function() {

          // Quotes are from Terry Pratchett's Discworld books
          var esResultTexts = [
            new esResultText({
              title: 'The colour of magic',
              quote: 'The only reason for walking into the jaws of Death is so\'s you can steal his gold teeth'
            }),
            new esResultText({
              title: 'The Light Fantastic',
              quote: 'The death of the warrior or the old man or the little child, this I understand, and I take ' +
              'away the pain and end the suffering. I do not understand this death-of-the-mind'
            }),
            new esResultText({
              title: 'Equal Rites',
              quote: 'Time passed, which, basically, is its job'
            }),
            new esResultText({
              title: 'Mort',
              quote: 'You don\'t see people at their best in this job, said Death.'
            })
          ];
          async.forEach(esResultTexts, config.saveAndWaitIndex, function() {
            setTimeout(done, config.INDEXING_TIMEOUT);
          });
        });
      });
    });
  });

  after(function(done) {
    esResultText.remove();
    esResultText.esClient.close();
    mongoose.disconnect();
    done();
  });

  describe('Hydrate without adding ES data', function() {
    it('should return simple objects', function(done) {

      esResultText.search({
        match_phrase: {
          quote: 'Death'
        }
      }, {
        hydrate: true
      }, function(err, res) {

        res.hits.total.should.eql(3);
        res.hits.hits.forEach(function(text) {
          text.should.not.have.property('_esResult');
        });

        done();
      });
    });

  });

  describe('Hydrate and add ES data', function() {
    it('should return object enhanced with _esResult', function(done) {

      esResultText.search({
        match_phrase: {
          quote: 'Death'
        }
      }, {
        hydrate: true,
        hydrateWithESResults: true,
        highlight: {
          fields: {
            quote: {}
          }
        }
      }, function(err, res) {

        res.hits.total.should.eql(3);
        res.hits.hits.forEach(function(model) {
          model.should.have.property('_esResult');
          model._esResult.should.have.property('_index');
          model._esResult._index.should.eql('esresulttexts');
          model._esResult.should.have.property('_type');
          model._esResult._type.should.eql('esresulttext');
          model._esResult.should.have.property('_id');
          model._esResult.should.have.property('_score');
          model._esResult.should.have.property('_source');
          model._esResult.should.have.property('highlight');
        });

        done();
      });
    });

  });
});
