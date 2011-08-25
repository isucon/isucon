use inc::Module::Install;
name 'Isucon';
all_from 'lib/Isucon.pm';

requires 'parent';
requires 'Scalar::Util';
requires 'Plack';
requires 'Plack::Middleware::Static';
requires 'Plack::Middleware::ReverseProxy';
requires 'Starman';
requires 'Router::Simple';
requires 'Cwd';
requires 'File::Basename';
requires 'Text::Xslate', 1.1003;
requires 'Text::Xslate::Bridge::TT2Like';
requires 'Try::Tiny', 0.09;
requires 'Class::Accessor::Lite';
requires 'DBI', 1.616;
requires 'DBD::mysql';
requires 'JSON';

WriteAll;
