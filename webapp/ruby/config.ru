app_dir = File.expand_path(File.dirname(__FILE__))

require 'sinatra'
require app_dir + "/app"

set :environment, (ENV['RACK_ENV'] || 'development').to_sym
set :root,        app_dir
set :app_file,    File.join(app_dir, 'app.rb')
disable :run

run ISUConApplication

