# -*- coding: utf-8 -*-

require 'sinatra/base'
require 'haml'
require 'mysql'

require 'json'

File.open(File.dirname(__FILE__) + '/../config/hosts.json'){|f| $config = JSON.parse(f.read)}

module Sinatra
  module ISUConHelper
    def connection
      return @handler if @handler
      @handler = Mysql.connect($config['servers']['database'].first, 'isuconapp', 'isunageruna', 'isucon', 3306)
      @handler.charset = 'utf8'
      @handler
    end

    def execute(sql, *params)
      st = connection.prepare(sql)
      st.execute(*params)
      st.free_result()
      nil
    end

    def execute_fetch_hash_all(sql, *params)
      st = connection.prepare(sql)
      st.execute(*params)
      results = []
      fieldnames = st.result_metadata.fetch_fields().map{|f| f.name.to_sym}
      st.each do |values|
        results.push(Hash[*[fieldnames,values].transpose.flatten])
      end
      st.free_result()
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
    title = request.params['title']
    body = request.params['body']
    article_post_query = 'INSERT INTO article SET title=?, body=?'
    execute(article_post_query, title, body)
    redirect '/'
  end

  get '/article/:articleid' do
    load_sidebar_data!
    article_query = 'SELECT id,title,body,created_at FROM article WHERE id=?';
    results = execute_fetch_hash_all(article_query, params[:articleid])
    halt 404 if results.size != 1
    article = results.first
    comments_query = 'SELECT name,body,created_at FROM comment WHERE article=? ORDER BY id';
    comments = execute_fetch_hash_all(comments_query, article[:id])
    haml :article, :locals => {:article => article, :comments => comments}
  end

  post '/comment/:articleid' do 
    name = request.params['name']
    body = request.params['body']
    comment_post_query = 'INSERT INTO comment SET article=?, name=?, body=?';
    execute(comment_post_query, params[:articleid], name, body)
    redirect '/article/' + params[:articleid].to_s
  end
end

ISUConApplication.run! :host => '0.0.0.0', :port => 5000

