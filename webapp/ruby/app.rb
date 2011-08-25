# -*- coding: utf-8 -*-

require 'sinatra/base'
require 'haml'
require 'mysql2'

require 'json'

File.open(File.dirname(__FILE__) + '/../config/hosts.json'){|f| $config = JSON.parse(f.read)}

$connection = Mysql2::Client.new(
                                 :host => $config['servers']['database'].first,
                                 :port => 3306,
                                 :username => 'isuconapp',
                                 :password => 'isunageruna',
                                 :database => 'isucon',
                                 :reconnect => true
                                 )

module Sinatra
  module ISUConHelper
    def connection
      $connection
    end

    def sql_escape(x)
      connection.escape(x)
    end

    def execute(sql)
      connection.query(sql)
    end

    def execute_fetch_hash_all(sql)
      results = []
      connection.query(sql).each do |r|
        results.push(Hash[r.map{|k,v| [k.to_sym, v]}])
      end
      results
    end

    def load_sidebar_data!
      sql = <<EOSQL
SELECT a.id, a.title FROM comment c LEFT JOIN article a ON c.article = a.id GROUP BY a.id ORDER BY MAX(c.created_at) DESC LIMIT 10
EOSQL
      @sidebaritems = execute_fetch_hash_all(sql)
    end
  end
end

class ISUConApplication < Sinatra::Base
  helpers Sinatra::ISUConHelper

  configure do
    set :public, File.dirname(__FILE__) + '/public'
    set :views, File.dirname(__FILE__) + '/views'
    set :haml, {:format => :html5}
  end

  get '/' do
    load_sidebar_data!
    toppage_query = 'SELECT id,title,body,created_at FROM article ORDER BY id DESC LIMIT 10'
    articles = execute_fetch_hash_all(toppage_query)
    haml :index, :locals => {:articles => articles}
  end

  get '/post' do 
    load_sidebar_data!
    haml :post
  end

  post '/post' do 
    title = sql_escape(request.params['title'])
    body = sql_escape(request.params['body'])
    article_post_query = "INSERT INTO article SET title='#{title}', body='#{body}'"
    execute(article_post_query)
    redirect '/'
  end

  get '/article/:articleid' do
    load_sidebar_data!
    article_id = sql_escape(params[:articleid])
    article_query = "SELECT id,title,body,created_at FROM article WHERE id='#{article_id}'";
    results = execute_fetch_hash_all(article_query)
    halt 404 if results.size != 1
    article = results.first
    comments_query = "SELECT name,body,created_at FROM comment WHERE article='#{article_id}' ORDER BY id";
    comments = execute_fetch_hash_all(comments_query)
    haml :article, :locals => {:article => article, :comments => comments}
  end

  post '/comment/:articleid' do 
    article_id = params[:articleid]
    name = sql_escape(request.params['name'])
    body = sql_escape(request.params['body'])
    comment_post_query = "INSERT INTO comment SET article=#{article_id.to_i}, name='#{name}', body='#{body}'";
    execute(comment_post_query, params[:articleid])
    redirect '/article/' + article_id.to_s
  end
end

ISUConApplication.run! :host => '0.0.0.0', :port => 5000

