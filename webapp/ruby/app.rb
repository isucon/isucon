# -*- coding: utf-8 -*-

require 'sinatra/base'
require 'haml'
require 'mysql'

class ISUConApplication < Sinatra::Base
  configure do
    set :public, File.dirname(__FILE__) + '/public'
    set :views, File.dirname(__FILE__) + '/views'
    set :haml, {:format => :html5}
  end

  get '/' do
    
  end

  get '/post' do 
  end

  post '/post' do 
  end

  get '/article/:articleid' do 
  end

  post '/comment/:articleid' do 
  end

end

ISUConApplication.run! :host => '0.0.0.0', :port => 5001

